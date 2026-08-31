import { db } from './db';
import { socket } from '../socket';
import { v4 as uuidv4 } from 'uuid';

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
      
      await db.commands.update(cmd.actionId, { status: 'SYNCING' });
      notifyListeners();
      
      try {
        const response: any = await new Promise((resolve, reject) => {
          socket.emit('COMMAND', { 
            actionId: cmd.actionId, 
            type: cmd.type, 
            payload: cmd.payload 
          }, (res: any) => resolve(res));
          
          setTimeout(() => reject(new Error('TIMEOUT')), 10000);
        });

        if (response.success || (response.duplicate && response.success !== false)) {
          // Success or acknowledged duplicate -> remove from queue
          await db.commands.delete(cmd.actionId);
        } else if (response.retryable === false) {
          // Non-retryable error
          console.error('Permanent command failure:', response.error);
          await db.commands.update(cmd.actionId, { status: 'REJECTED', lastError: response.error });
        } else {
          // Retryable error
          await db.commands.update(cmd.actionId, { status: 'PENDING', lastError: response.error });
          break; // Stop flushing on retryable error
        }
      } catch (err: any) {
        // Timeout or network error
        await db.commands.update(cmd.actionId, { status: 'PENDING', lastError: err.message });
        break; 
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
