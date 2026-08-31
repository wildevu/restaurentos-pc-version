const { createClient } = require('@libsql/client');
const { drizzle } = require('drizzle-orm/libsql');
const { sqliteTable, text, integer } = require('drizzle-orm/sqlite-core');
const crypto = require('crypto');

const idempotencyKeys = sqliteTable('idempotency_keys', {
  id: text('id').notNull(),
  restaurantId: text('restaurant_id').notNull(),
  actorUserId: text('actor_user_id').notNull(),
  operation: text('operation').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

const client = createClient({ url: 'file:local_hub.db' });
const db = drizzle(client);

async function processCommand(actionId) {
  try {
    const res = await db.insert(idempotencyKeys).values({
      id: actionId,
      restaurantId: 'test',
      actorUserId: 'test',
      operation: 'TEST',
      createdAt: new Date()
    }).onConflictDoNothing().run();
    
    if (res.rowsAffected === 0) {
       return { duplicate: true, actionId };
    }
    
    return await db.transaction(async (tx) => {
      // Simulate business logic taking some time
      await new Promise(r => setTimeout(r, 200));
      return { duplicate: false, actionId };
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
