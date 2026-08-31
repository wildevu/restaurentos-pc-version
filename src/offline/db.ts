import Dexie, { type EntityTable } from 'dexie';

export interface QueuedCommand {
  actionId: string;
  type: string;
  payload: any;
  createdAt: Date;
  status: 'PENDING' | 'SYNCING' | 'REJECTED';
  lastError?: string;
}

export const db = new Dexie('RestaurantOS_OfflineDB') as Dexie & {
  commands: EntityTable<QueuedCommand, 'actionId'>;
};

db.version(1).stores({
  commands: 'actionId, createdAt, status'
});
