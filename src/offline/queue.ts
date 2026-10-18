import { db } from './db';
import { socket } from '../socket';
import { uuidv4 } from '../utils/uuid';

export type QueueChangeReason = 'changed' | 'rejected' | 'hydrate';
export type CommandStatusChangeCallback = (reason?: QueueChangeReason) => void;
let statusListeners: CommandStatusChangeCallback[] = [];

export function subscribeToQueue(callback: CommandStatusChangeCallback) {
  statusListeners.push(callback);
  return () => {
    statusListeners = statusListeners.filter(listener => listener !== callback);
  };
}

function notifyListeners(reason: QueueChangeReason = 'changed') {
  for (const listener of statusListeners) {
    try { listener(reason); } catch (error) { console.error('Queue listener failed', error); }
  }
}

export type OptimisticCommandCallback = (type: string, payload: any) => void;
let optimisticListeners: OptimisticCommandCallback[] = [];

export function subscribeToOptimistic(callback: OptimisticCommandCallback) {
  optimisticListeners.push(callback);
  return () => {
    optimisticListeners = optimisticListeners.filter(listener => listener !== callback);
  };
}

const MAX_ATTEMPTS = 5;
const ACK_TIMEOUT_MS = 12000;
let flushPromise: Promise<void> | null = null;
let flushRequested = false;
let retryFlushTimer: ReturnType<typeof setTimeout> | null = null;

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function backoffMs(attempt: number): number {
  return Math.min(8000, 500 * Math.pow(2, Math.max(0, attempt - 1)));
}

function scheduleFlushRetry(): void {
  if (retryFlushTimer) return;
  retryFlushTimer = setTimeout(() => {
    retryFlushTimer = null;
    if (socket.connected) void flushQueue();
  }, 15000);
}

function sendCommand(command: { actionId: string; type: string; payload: any }): Promise<any> {
  if (!socket.connected) return Promise.reject(new Error('SOCKET_DISCONNECTED'));

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('ACK_TIMEOUT'));
    }, ACK_TIMEOUT_MS);

    const settle = (error?: Error, response?: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      if (error) reject(error);
      else resolve(response);
    };

    try {
      socket.emit('COMMAND', {
        actionId: command.actionId,
        type: command.type,
        payload: command.payload
      }, (response: any) => {
        if (!response || typeof response !== 'object') {
          settle(new Error('EMPTY_ACKNOWLEDGEMENT'));
          return;
        }
        settle(undefined, response);
      });
    } catch (error: any) {
      settle(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export async function executeCommand(type: string, payload: any): Promise<{ actionId: string, status: string }> {
  const actionId = uuidv4();
  const stablePayload = { ...(payload || {}) };

  // Keep optimistic IDs identical to server IDs so dependent offline operations
  // (e.g. add then edit/remove an item) remain valid when replayed.
  if (type === 'OPEN_TABLE' && !stablePayload.clientOrderId) {
    stablePayload.clientOrderId = uuidv4();
  }
  if (type === 'ADD_ITEM' && !stablePayload.clientItemId) {
    stablePayload.clientItemId = uuidv4();
  }

  // Use a read/write transaction and a strictly increasing timestamp to preserve
  // FIFO command ordering even when multiple actions are enqueued in one millisecond
  // or from separate tabs sharing the same IndexedDB database.
  await db.transaction('rw', db.commands, async () => {
    const latest = await db.commands.orderBy('createdAt').last();
    const latestTime = latest?.createdAt ? new Date(latest.createdAt).getTime() : 0;
    const createdAt = new Date(Math.max(Date.now(), Number.isFinite(latestTime) ? latestTime + 1 : Date.now()));
    await db.commands.add({
      actionId,
      type,
      payload: stablePayload,
      createdAt,
      status: 'PENDING'
    });
  });

  notifyListeners();
  optimisticListeners.forEach(listener => {
    try { listener(type, stablePayload); } catch (error) { console.error('Optimistic listener failed', error); }
  });

  if (socket.connected) void flushQueue();
  return { actionId, status: 'PENDING' };
}

async function drainQueue(): Promise<void> {
  while (socket.connected) {
    // Re-query on every pass. A fixed initial snapshot strands commands added
    // while the current drain is active.
    const pendingCommands = await db.commands
      .where('status').anyOf('PENDING', 'SYNCING')
      .sortBy('createdAt');
    const command = pendingCommands[0];
    if (!command) return;

    let attempts = 0;
    let stopDrain = false;

    while (attempts < MAX_ATTEMPTS && socket.connected) {
      await db.commands.update(command.actionId, { status: 'SYNCING' });
      notifyListeners();

      let response: any;
      try {
        response = await sendCommand(command);
      } catch (error: any) {
        attempts++;
        const message = error?.message || String(error);
        await db.commands.update(command.actionId, {
          status: 'PENDING',
          lastError: attempts >= MAX_ATTEMPTS
            ? 'Acknowledgement unavailable; the server may already have committed this action. It will retry with the same action ID when the hub reconnects.'
            : message
        });
        notifyListeners();

        // A timeout is an uncertain outcome, not proof that the mutation failed.
        // Preserve the actionId and stop draining to avoid duplicate side effects.
        if (attempts >= MAX_ATTEMPTS) scheduleFlushRetry();
        if (!socket.connected || attempts >= MAX_ATTEMPTS) {
          stopDrain = true;
          break;
        }
        await delay(backoffMs(attempts));
        continue;
      }

      if (response.success === true || (response.duplicate === true && response.success !== false)) {
        await db.commands.delete(command.actionId);
        notifyListeners();
        break;
      }

      if (response.retryable === false) {
        await db.commands.update(command.actionId, {
          status: 'REJECTED',
          lastError: response.error || response.message || 'The server rejected this command.'
        });
        notifyListeners('rejected');
        break;
      }

      attempts++;
      const errorMessage = response.error || (response.busy ? 'The hub is busy; retrying.' : 'Temporary hub error; retrying.');
      await db.commands.update(command.actionId, {
        status: attempts >= MAX_ATTEMPTS ? 'PENDING' : 'SYNCING',
        lastError: attempts >= MAX_ATTEMPTS
          ? 'The hub did not accept confirmation after repeated retries. This action remains queued and will be retried after reconnect.'
          : errorMessage
      });
      notifyListeners();

      if (attempts >= MAX_ATTEMPTS) {
        scheduleFlushRetry();
        stopDrain = true;
        break;
      }
      await delay(backoffMs(attempts));
    }

    if (stopDrain || !socket.connected) return;
  }
}

export async function flushQueue(): Promise<void> {
  if (!socket.connected) return;
  if (retryFlushTimer) {
    clearTimeout(retryFlushTimer);
    retryFlushTimer = null;
  }
  if (flushPromise) {
    flushRequested = true;
    return flushPromise;
  }

  flushRequested = false;
  const currentRun = drainQueue();
  flushPromise = currentRun;
  try {
    await currentRun;
  } catch (error) {
    console.error('Offline queue drain failed; queued actions are preserved', error);
  } finally {
    if (flushPromise === currentRun) flushPromise = null;
    notifyListeners();

    // Catch a command enqueued after the final DB scan but before flushPromise
    // was cleared. Only restart when a caller explicitly requested a follow-up.
    if (flushRequested && socket.connected) {
      flushRequested = false;
      void flushQueue();
    }
  }
}

export async function getPendingCount(): Promise<number> {
  return db.commands.where('status').anyOf('PENDING', 'SYNCING').count();
}

export async function getRejectedCommands() {
  return db.commands.where('status').equals('REJECTED').toArray();
}

export async function retryCommand(actionId: string) {
  await db.commands.update(actionId, { status: 'PENDING', lastError: undefined });
  notifyListeners();
  if (socket.connected) void flushQueue();
}

export async function dismissCommand(actionId: string) {
  await db.commands.delete(actionId);
  notifyListeners('rejected');
}

export async function clearRejectedCommands() {
  const rejected = await getRejectedCommands();
  await db.commands.bulkDelete(rejected.map(command => command.actionId));
  notifyListeners('rejected');
}
