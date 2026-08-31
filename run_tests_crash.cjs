const { createClient } = require('@libsql/client');
const { drizzle } = require('drizzle-orm/libsql');
const crypto = require('crypto');
const assert = require('assert');

async function run() {
  const dbModule = require('./src/db/index');
  const db = dbModule.db;
  const queries = require('./src/db/queries');
  const schema = require('./src/db/schema');
  const { eq } = require('drizzle-orm');
  
  const user = { id: 'u1', restaurantId: 'r1', username: 'testuser' };
  
  // Seed basic data for testing if needed
  await db.insert(schema.restaurants).values({ id: 'r1', name: 'Test Rest', createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
  await db.insert(schema.users).values({ id: 'u1', restaurantId: 'r1', name: 'User', username: 'u1', passwordHash: 'hash', role: 'MANAGER', createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
  await db.insert(schema.tables).values({ id: 't2', number: 2, status: 'EMPTY', createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
  await db.insert(schema.menuCategories).values({ id: 'c1', name: 'Drinks' }).onConflictDoNothing();
  await db.insert(schema.menuItems).values({ id: 'm1', categoryId: 'c1', name: 'Coke', price: 2, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();

  console.log("TEST 1 - Simultaneous duplicate command");
  const actionId1 = crypto.randomUUID();
  const [res1a, res1b] = await Promise.all([
    queries.processCommand({ type: 'OPEN_TABLE', actionId: actionId1, payload: { tableId: 't2' } }, user),
    queries.processCommand({ type: 'OPEN_TABLE', actionId: actionId1, payload: { tableId: 't2' } }, user)
  ]);
  assert.ok(res1a.success || res1b.success);
  assert.ok(res1a.duplicate !== res1b.duplicate);

  console.log("TEST 2 - Crash before commit");
  // We simulate a crash by manually starting a transaction, inserting idempotency, doing business logic, then throwing
  const actionId2 = crypto.randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.idempotencyKeys).values({
        id: actionId2, restaurantId: 'r1', actorUserId: 'u1', operation: 'ADD_ITEM', createdAt: new Date()
      });
      throw new Error('CRASH');
    });
  } catch (e) {}
  
  // Now retry
  const res2 = await queries.processCommand({ type: 'ADD_ITEM', actionId: actionId2, payload: { tableId: 't2', menuItemId: 'm1' } }, user);
  assert.strictEqual(res2.success, true);
  assert.strictEqual(res2.duplicate, false);

  console.log("TEST 5 - Permanent validation failure");
  const actionId5 = crypto.randomUUID();
  try {
    // Try opening an already open table
    await queries.processCommand({ type: 'OPEN_TABLE', actionId: actionId5, payload: { tableId: 't2' } }, user);
    assert.fail('Should have thrown');
  } catch (e) {
    assert.ok(e.name === 'CommandError');
    assert.strictEqual(e.isRetryable, false);
  }

  console.log("ALL TESTS PASSED");
  process.exit(0);
}
run().catch(console.error);
