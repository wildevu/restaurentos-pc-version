import crypto from 'crypto';
import assert from 'assert';
import { db } from './src/db/index';
import * as queries from './src/db/queries';
import * as schema from './src/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  console.log('Running isolated core queries & audit tests...');
  const user = { id: 'u1', restaurantId: 'r1', username: 'testuser' };
  const tableId = `tbl_test_${Date.now()}`;
  
  // Seed basic data for testing if needed
  await db.insert(schema.restaurants).values({ id: 'r1', name: 'Test Rest', createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
  await db.insert(schema.users).values({ id: 'u1', restaurantId: 'r1', name: 'User', username: 'u1', passwordHash: 'hash', role: 'MANAGER', createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
  await db.insert(schema.tables).values({ id: tableId, number: 99, status: 'EMPTY', createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
  await db.insert(schema.menuCategories).values({ id: 'c1', name: 'Drinks' }).onConflictDoNothing();
  await db.insert(schema.menuItems).values({ id: 'm1', categoryId: 'c1', name: 'Coke', price: 2, createdAt: new Date(), updatedAt: new Date() }).onConflictDoNothing();
  
  // TEST A: Simultaneous
  const actionIdA1 = crypto.randomUUID();
  const [resA1, resA2] = await Promise.all([
    queries.processCommand({ type: 'OPEN_TABLE', actionId: actionIdA1, payload: { tableId } }, user),
    queries.processCommand({ type: 'OPEN_TABLE', actionId: actionIdA1, payload: { tableId } }, user)
  ]);
  
  console.log('TEST A Res1:', resA1.success, resA1.duplicate);
  console.log('TEST A Res2:', resA2.success, resA2.duplicate);
  
  assert.ok(resA1.success || resA2.success);
  assert.ok(resA1.duplicate !== resA2.duplicate);
  
  const activeOrder = await db.select().from(schema.orders).where(eq(schema.orders.tableId, tableId)).get();
  assert.ok(activeOrder);

  // TEST B: Restart duplicate
  const actionIdB = crypto.randomUUID();
  const resB1 = await queries.processCommand({ type: 'ADD_ITEM', actionId: actionIdB, payload: { tableId, menuItemId: 'm1' } }, user);
  const resB2 = await queries.processCommand({ type: 'ADD_ITEM', actionId: actionIdB, payload: { tableId, menuItemId: 'm1' } }, user);
  
  console.log('TEST B Res1:', resB1.success, resB1.duplicate, resB1.stateVersion);
  console.log('TEST B Res2:', resB2.success, resB2.duplicate, resB2.stateVersion);
  
  assert.ok(!resB1.duplicate && resB2.duplicate);
  assert.strictEqual(resB1.stateVersion, resB2.stateVersion);

  // TEST C: State Version
  const v1 = resB1.stateVersion;
  const actionIdC = crypto.randomUUID();
  const resC1 = await queries.processCommand({ type: 'ADD_ITEM', actionId: actionIdC, payload: { tableId, menuItemId: 'm1' } }, user);
  console.log('TEST C V1:', v1, 'V2:', resC1.stateVersion);
  assert.strictEqual(resC1.stateVersion, v1! + 1);

  // TEST E: Removal audit
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, activeOrder.id));
  const orderItemId = items[0].id;
  
  // Decrement 2 -> 1
  const actionIdE1 = crypto.randomUUID();
  await queries.processCommand({ type: 'DECREMENT_ITEM', actionId: actionIdE1, payload: { tableId, orderItemId } }, user);
  
  // Decrement 1 -> 0
  const actionIdE2 = crypto.randomUUID();
  await queries.processCommand({ type: 'DECREMENT_ITEM', actionId: actionIdE2, payload: { tableId, orderItemId } }, user);
  
  // Add another item and explicitly remove
  const actionIdE3 = crypto.randomUUID();
  await queries.processCommand({ type: 'ADD_ITEM', actionId: actionIdE3, payload: { tableId, menuItemId: 'm1' } }, user);
  const items2 = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, activeOrder.id));
  const orderItemId2 = items2[0].id;
  
  const actionIdE4 = crypto.randomUUID();
  await queries.processCommand({ type: 'REMOVE_ITEM', actionId: actionIdE4, payload: { tableId, orderItemId: orderItemId2 } }, user);
  
  const audits = await db.select().from(schema.auditEvents).where(eq(schema.auditEvents.restaurantId, 'r1'));
  const decrementAudits = audits.filter(a => a.action === 'ITEM_DECREMENTED');
  const removedAudits = audits.filter(a => a.action === 'ITEM_REMOVED');
  
  console.log('TEST E: Decrement Audits:', decrementAudits.length);
  console.log('TEST E: Removed Audits:', removedAudits.length);
  assert.ok(removedAudits.some(a => a.metadata?.includes('quantity_reached_zero')));
  assert.ok(removedAudits.some(a => a.metadata?.includes('explicit_remove')));
  
  // Cleanup
  await queries.processCommand({ type: 'CLOSE_TABLE', actionId: crypto.randomUUID(), payload: { tableId } }, user);
  console.log("ALL TESTS PASSED");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
