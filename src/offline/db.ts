import Dexie, { type EntityTable } from 'dexie';

export interface QueuedCommand {
  actionId: string;
  type: string;
  payload: any;
  createdAt: Date;
  status: 'PENDING' | 'SYNCING' | 'REJECTED';
  lastError?: string;
}

export interface ItemIdAlias {
  fromId: string;
  toId: string;
  createdAt: Date;
}

export const db = new Dexie('RestaurantOS_OfflineDB') as Dexie & {
  commands: EntityTable<QueuedCommand, 'actionId'>;
  itemAliases: EntityTable<ItemIdAlias, 'fromId'>;
};

db.version(1).stores({
  commands: 'actionId, createdAt, status'
});

// Preserve the existing durable command queue and add a persistent local map
// for server-canonical item IDs discovered during offline reconciliation.
db.version(2).stores({
  commands: 'actionId, createdAt, status',
  itemAliases: 'fromId, toId, createdAt'
});

let openingDatabase: Promise<void> | null = null;
let storageProbeSequence = 0;

db.on('blocked', () => {
  console.warn('RestaurantOS offline storage upgrade is blocked by another tab. Close duplicate RestaurantOS tabs and reload.');
});

db.on('versionchange', () => {
  // Release this connection so a newer app tab can safely upgrade the schema.
  db.close();
});

function describeStorageFailure(error: any): string {
  const name = error?.name || error?.inner?.name || 'UnknownError';
  const detail = error?.message || error?.inner?.message || String(error);
  return `This device could not open or write its local RestaurantOS storage (${name}). Close duplicate RestaurantOS tabs, leave Private Browsing, and check that the device has available storage. Do not clear browser/site data: it may contain unsynchronized restaurant actions. Details: ${detail}`;
}

/**
 * Open IndexedDB and prove a read/write transaction can commit before staff
 * are allowed to enqueue an operational command. The probe is removed in the
 * same transaction and never changes restaurant data.
 */
export async function ensureOfflineStorageReady(): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    throw new Error('This browser does not provide IndexedDB, which RestaurantOS requires for safe offline command storage. Open RestaurantOS in a supported browser.');
  }
  if (db.isOpen()) return;
  if (openingDatabase) return openingDatabase;

  openingDatabase = (async () => {
    try {
      await db.open();
      storageProbeSequence += 1;
      const probeId = `__restaurantos_storage_probe__${Date.now()}_${storageProbeSequence}`;
      await db.transaction('rw', db.commands, db.itemAliases, async () => {
        await db.commands.put({
          actionId: probeId,
          type: '__STORAGE_PROBE__',
          payload: null,
          createdAt: new Date(),
          status: 'PENDING'
        });
        await db.commands.delete(probeId);

        const aliasProbeId = `__restaurantos_alias_probe__${probeId}`;
        await db.itemAliases.put({ fromId: aliasProbeId, toId: aliasProbeId, createdAt: new Date() });
        await db.itemAliases.delete(aliasProbeId);
      });
    } catch (error: any) {
      try { db.close(); } catch {}
      throw new Error(describeStorageFailure(error));
    } finally {
      openingDatabase = null;
    }
  })();

  return openingDatabase;
}
