const { createClient } = require('@libsql/client');
const { drizzle } = require('drizzle-orm/libsql');
const { sqliteTable, text, integer } = require('drizzle-orm/sqlite-core');
const crypto = require('crypto');
const fs = require('fs');

const idempotencyKeys = sqliteTable('idempotency_keys', {
  id: text('id').primaryKey(),
  restaurantId: text('restaurant_id').notNull(),
  actorUserId: text('actor_user_id').notNull(),
  operation: text('operation').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

const client = createClient({ url: 'file:local_hub.db' });
const db = drizzle(client);

async function processCommand(actionId) {
  try {
    return await db.transaction(async (tx) => {
      // 1. Idempotency Check with immediate lock acquisition
      try {
        await tx.insert(idempotencyKeys).values({
          id: actionId,
          restaurantId: 'test',
          actorUserId: 'test',
          operation: 'TEST',
          createdAt: new Date()
        });
      } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
           return { duplicate: true };
        }
        throw err;
      }
      
      // Simulate business logic taking some time
      await new Promise(r => setTimeout(r, 100));
      return { duplicate: false };
    });
  } catch (err) {
    return { error: err.message };
  }
}

async function run() {
  const actionId = crypto.randomUUID();
  console.log('Testing actionId:', actionId);
  const [res1, res2] = await Promise.all([
    processCommand(actionId),
    processCommand(actionId)
  ]);
  console.log('Res1:', res1);
  console.log('Res2:', res2);
}

run();
