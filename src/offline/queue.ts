import { db } from './db';
import { socket } from '../socket';
import { uuidv4 } from '../utils/uuid';

export type CommandStatusChangeCallback = () => void;
let statusListeners: CommandStatusChangeCallback[] = [];

export function subscribeToQueue(callback: CommandStatusChangeCallback) {
  statusListeners.push(callback);
  return () => {
    statusListeners = statusListeners.filter(l => l !== callback);
  };
}

function notifyListeners() {
  statusListeners.forEach(cb => cb());
}

let isFlushing = false;

export async function executeCommand(type: string, payload: any): Promise<{ actionId: string, status: string }> {
  const actionId = uuidv4();
  
  await db.commands.add({
    actionId,
    type,
    payload,
    createdAt: new Date(),
    status: 'PENDING'
  });
  notifyListeners();
  optimisticListeners.forEach(cb => cb(type, payload));

  if (socket.connected) {
    flushQueue();
  }

  return { actionId, status: 'PENDING' };
}

export async function flushQueue(): Promise<void> {
  if (isFlushing || !socket.connected) return;
  isFlushing = true;
  notifyListeners();
  
  try {
    const pendingCommands = await db.commands
      .where('status').anyOf('PENDING', 'SYNCING')
      .sortBy('createdAt');
      
    for (const cmd of pendingCommands) {
      if (!socket.connected) break;

      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        if (!socket.connected) break;

        await db.commands.update(cmd.actionId, { status: 'SYNCING' });
        notifyListeners();

        try {
          const response: any = await new Promise((resolve, reject) => {
            socket.emit('COMMAND', {
              actionId: cmd.actionId,
              type: cmd.type,
              payload: cmd.payload
            }, (res: any) => resolve(res));

            setTimeout(() => reject(new Error('TIMEOUT')), 12000);
          });

          if (response.success || (response.duplicate && response.success !== false)) {
            await db.commands.delete(cmd.actionId);
            break; // Success - move to next command
          } else if (response.retryable === false) {
            console.error('Permanent command failure:', response.error);
            await db.commands.update(cmd.actionId, { status: 'REJECTED', lastError: response.error });
            break; // Non-retryable - mark rejected and move on
          } else if (response.busy) {
            // Server busy -> backoff and retry this command
            attempts++;
            await new Promise(r => setTimeout(r, 1000 * Math.pow(1.5, attempts)));
            continue;
          } else {
            // Other retryable error -> backoff
            attempts++;
            await db.commands.update(cmd.actionId, { status: 'PENDING', lastError: response.error });
            await new Promise(r => setTimeout(r, 1000 * Math.pow(1.5, attempts)));
          }
        } catch (err: any) {
          attempts++;
          await db.commands.update(cmd.actionId, { status: 'PENDING', lastError: err.message });
          if (attempts >= maxAttempts) {
            await db.commands.update(cmd.actionId, { status: 'REJECTED', lastError: `Max retries (${maxAttempts}) exceeded` });
            break;
          }
          await new Promise(r => setTimeout(r, 1000 * Math.pow(1.5, attempts)));
        }
      }
      notifyListeners();
    }
  } finally {
    isFlushing = false;
    notifyListeners();
  }
}

export async function getPendingCount(): Promise<number> {
  return await db.commands.where('status').anyOf('PENDING', 'SYNCING').count();
}

export async function getRejectedCommands() {
  return await db.commands.where('status').equals('REJECTED').toArray();
}

export async function retryCommand(actionId: string) {
  await db.commands.update(actionId, { status: 'PENDING', lastError: undefined });
  notifyListeners();
  if (socket.connected) {
    flushQueue();
  }
}

export async function dismissCommand(actionId: string) {
  await db.commands.delete(actionId);
  notifyListeners();
}

export async function clearRejectedCommands() {
  const rejected = await getRejectedCommands();
  for (const cmd of rejected) {
    await db.commands.delete(cmd.actionId);
  }
  notifyListeners();
}

export type OptimisticCommandCallback = (type: string, payload: any) => void;
let optimisticListeners: OptimisticCommandCallback[] = [];

export function subscribeToOptimistic(callback: OptimisticCommandCallback) {
  optimisticListeners.push(callback);
  return () => {
    optimisticListeners = optimisticListeners.filter(l => l !== callback);
  };
}

// We need to modify executeCommand to trigger notifyOptimisticListeners
