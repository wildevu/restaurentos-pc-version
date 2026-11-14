import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';

// Isolated temporary storage: this test must never touch a restaurant's real DB.
const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'restaurantos-command-test-'));
process.env.NODE_ENV = 'test';
process.env.RESTAURANTOS_DATA_DIR = testDataDir;
process.env.DB_PATH = path.join(testDataDir, 'data', 'restaurantos-test.db');
process.env.BACKUP_DIR = path.join(testDataDir, 'backups');
process.env.LOG_DIR = path.join(testDataDir, 'logs');
process.env.AUTO_REPAIR_DB = 'false';

let dbModule: any;
try {
  dbModule = await import('../src/db/index');
  const schema = await import('../src/db/schema');
  const { processCommand } = await import('../src/db/queries');

  await dbModule.runMigrations();
  const db = dbModule.db;
  const now = new Date();
  const restaurantId = randomUUID();
  const userId = randomUUID();
  const tableId = randomUUID();
  const categoryId = randomUUID();
  const menuItemId = randomUUID();

  await db.insert(schema.restaurants).values({
    id: restaurantId,
    name: 'Isolated Reliability Test Restaurant',
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.users).values({
    id: userId,
    restaurantId,
    name: 'Reliability Test Owner',
    username: 'test_' + randomUUID().replace(/-/g, ''),
    passwordHash: 'not-a-real-login-hash',
    role: 'OWNER',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.tables).values({
    id: tableId,
    number: 1,
    label: 'Test table',
    status: 'EMPTY',
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.menuCategories).values({
    id: categoryId,
    name: 'Test category',
  });
  await db.insert(schema.menuItems).values({
    id: menuItemId,
    categoryId,
    name: 'Test item',
    price: 2.5,
    createdAt: now,
    updatedAt: now,
  });

  const user = { id: userId, restaurantId, username: 'test-owner' };
  const orderId = randomUUID();
  const open = {
    actionId: randomUUID(),
    type: 'OPEN_TABLE',
    payload: { tableId, covers: 2, clientOrderId: orderId },
  };

  const openFirst = await processCommand(open as any, user as any);
  const openReplay = await processCommand(open as any, user as any);
  assert.equal(openFirst.success, true, 'first OPEN_TABLE succeeds');
  assert.equal(openFirst.duplicate, false, 'first OPEN_TABLE is not a duplicate');
  assert.equal(openReplay.success, true, 'replayed OPEN_TABLE acknowledges success');
  assert.equal(openReplay.duplicate, true, 'replayed OPEN_TABLE is idempotent');
  assert.equal(openReplay.stateVersion, openFirst.stateVersion, 'replay does not increment state version');
  const savedOrder = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get();
  assert.ok(savedOrder, 'server persisted the stable client-generated order ID');

  const itemId = randomUUID();
  const add = {
    actionId: randomUUID(),
    type: 'ADD_ITEM',
    payload: { tableId, menuItemId, notes: 'offline note', clientItemId: itemId },
  };
  const addFirst = await processCommand(add as any, user as any);
  const addReplay = await processCommand(add as any, user as any);
  assert.equal(addFirst.success, true, 'first ADD_ITEM succeeds');
  assert.equal(addReplay.duplicate, true, 'replayed ADD_ITEM is idempotent');
  assert.equal(addReplay.stateVersion, addFirst.stateVersion, 'replayed ADD_ITEM does not increment state version');

  // A delayed retry of an older action must still receive a current snapshot
  // so clients recover even when the original broadcast was missed.
  const delayedOpenReplay = await processCommand(open as any, user as any);
  assert.equal(delayedOpenReplay.duplicate, true, 'delayed OPEN_TABLE retry remains idempotent');
  assert.equal(delayedOpenReplay.stateVersion, addFirst.stateVersion, 'duplicate retry reports the current hub version');
  assert.equal(delayedOpenReplay.state.orders[0].items.length, 1, 'duplicate retry returns current authoritative order contents');

  const savedItem = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, itemId)).get();
  assert.ok(savedItem, 'server persisted the stable client-generated item ID');
  assert.equal(savedItem.quantity, 1, 'replaying ADD_ITEM did not create a second item');
  assert.equal(savedItem.notes, 'offline note', 'initial item notes survive server persistence');

  const increment = { actionId: randomUUID(), type: 'INCREMENT_ITEM', payload: { tableId, orderItemId: itemId } };
  await processCommand(increment as any, user as any);
  const incrementReplay = await processCommand(increment as any, user as any);
  assert.equal(incrementReplay.duplicate, true, 'replayed INCREMENT_ITEM is idempotent');
  const incrementedItem = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, itemId)).get();
  assert.equal(incrementedItem.quantity, 2, 'replayed increment did not apply twice to item quantity');

  const concurrentIncrements = Array.from({ length: 5 }, () => ({
    actionId: randomUUID(),
    type: 'INCREMENT_ITEM',
    payload: { tableId, orderItemId: itemId }
  }));
  await Promise.all(concurrentIncrements.map(command => processCommand(command as any, user as any)));
  const concurrentItem = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, itemId)).get();
  assert.equal(concurrentItem.quantity, 7, 'concurrent increments are serialized without losing updates');

  const note = {
    actionId: randomUUID(),
    type: 'SET_ITEM_NOTE',
    payload: { tableId, orderItemId: itemId, notes: 'verified note update' },
  };
  const noteResult = await processCommand(note as any, user as any);
  assert.equal(noteResult.success, true, 'queued note update accepts the stable client item ID');
  const notedItem = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, itemId)).get();
  assert.equal(notedItem.notes, 'verified note update', 'note update targeted the stable client item ID');

  const decrement = { actionId: randomUUID(), type: 'DECREMENT_ITEM', payload: { tableId, orderItemId: itemId } };
  const decrementFirst = await processCommand(decrement as any, user as any);
  const decrementReplay = await processCommand(decrement as any, user as any);
  assert.equal(decrementReplay.duplicate, true, 'replayed DECREMENT_ITEM is idempotent');
  const decrementedItem = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, itemId)).get();
  assert.equal(decrementedItem.quantity, 6, 'DECREMENT_ITEM decrements exactly once after concurrent increments');

  // Kitchen can prepare and mark items ready; waiter can only serve ready items.
  const kitchenUserId = randomUUID();
  await db.insert(schema.users).values({
    id: kitchenUserId,
    restaurantId,
    name: 'Kitchen Test User',
    username: 'kitchen_' + randomUUID().replace(/-/g, ''),
    passwordHash: 'not-a-real-login-hash',
    role: 'KITCHEN',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  const kitchenUser = { id: kitchenUserId, restaurantId, username: 'kitchen-test' };
  await processCommand({ actionId: randomUUID(), type: 'UPDATE_ITEM_KITCHEN_STATUS', payload: { orderItemId: itemId, status: 'PREPARING' } } as any, kitchenUser as any);
  await processCommand({ actionId: randomUUID(), type: 'UPDATE_ITEM_KITCHEN_STATUS', payload: { orderItemId: itemId, status: 'READY' } } as any, kitchenUser as any);

  const waiterUserId = randomUUID();
  await db.insert(schema.users).values({
    id: waiterUserId,
    restaurantId,
    name: 'Waiter Test User',
    username: 'waiter_' + randomUUID().replace(/-/g, ''),
    passwordHash: 'not-a-real-login-hash',
    role: 'WAITER',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  const waiterUser = { id: waiterUserId, restaurantId, username: 'waiter-test' };
  await processCommand({ actionId: randomUUID(), type: 'UPDATE_ITEM_KITCHEN_STATUS', payload: { orderItemId: itemId, status: 'SERVED' } } as any, waiterUser as any);
  const servedItem = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, itemId)).get();
  assert.equal(servedItem.kitchenStatus, 'SERVED', 'waiter may mark a READY item as SERVED');
  await assert.rejects(
    () => processCommand({ actionId: randomUUID(), type: 'UPDATE_ITEM_KITCHEN_STATUS', payload: { orderItemId: itemId, status: 'READY' } } as any, waiterUser as any),
    /only mark ready items as served/i,
    'waiter cannot perform kitchen preparation status changes'
  );
  await assert.rejects(
    () => processCommand({ actionId: randomUUID(), type: 'UPDATE_ITEM_KITCHEN_STATUS', payload: { orderItemId: itemId, status: 'PREPARING' } } as any, kitchenUser as any),
    /served items cannot be returned/i,
    'kitchen cannot move a served item back into active preparation'
  );
  await assert.rejects(
    () => processCommand({
      actionId: randomUUID(),
      type: 'BATCH_UPDATE_KITCHEN_STATUS',
      payload: { orderId, orderItemIds: [itemId], status: 'PREPARING' }
    } as any, kitchenUser as any),
    /served items cannot be returned/i,
    'kitchen batch updates cannot reopen served items'
  );

  const batchItemId = randomUUID();
  await processCommand({
    actionId: randomUUID(),
    type: 'ADD_ITEM',
    payload: { tableId, menuItemId, clientItemId: batchItemId }
  } as any, user as any);
  const validBatch = {
    actionId: randomUUID(),
    type: 'BATCH_UPDATE_KITCHEN_STATUS',
    payload: { orderId, orderItemIds: [batchItemId], status: 'PREPARING' }
  };
  const validBatchResult = await processCommand(validBatch as any, kitchenUser as any);
  assert.equal(validBatchResult.success, true, 'kitchen batch update applies to the exact active-order item set');

  await processCommand({ actionId: randomUUID(), type: 'UPDATE_ITEM_KITCHEN_STATUS', payload: { orderItemId: batchItemId, status: 'READY' } } as any, kitchenUser as any);
  await processCommand({ actionId: randomUUID(), type: 'UPDATE_ITEM_KITCHEN_STATUS', payload: { orderItemId: batchItemId, status: 'SERVED' } } as any, waiterUser as any);

  const invalidBatch = {
    actionId: randomUUID(),
    type: 'BATCH_UPDATE_KITCHEN_STATUS',
    payload: { orderId, orderItemIds: [batchItemId, randomUUID()], status: 'READY' }
  };
  await assert.rejects(
    () => processCommand(invalidBatch as any, kitchenUser as any),
    /selected order items are missing/i,
    'batch update cannot silently apply only a subset of requested item IDs'
  );

  const remove = { actionId: randomUUID(), type: 'REMOVE_ITEM', payload: { tableId, orderItemId: itemId } };
  const removeFirst = await processCommand(remove as any, waiterUser as any);
  const removeReplay = await processCommand(remove as any, waiterUser as any);
  assert.equal(removeReplay.duplicate, true, 'replayed REMOVE_ITEM is idempotent');
  const removedItem = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, itemId)).get();
  assert.equal(removedItem, undefined, 'REMOVE_ITEM removes the targeted active-order item');

  const cashierUserId = randomUUID();
  await db.insert(schema.users).values({
    id: cashierUserId,
    restaurantId,
    name: 'Cashier Test User',
    username: 'cashier_' + randomUUID().replace(/-/g, ''),
    passwordHash: 'not-a-real-login-hash',
    role: 'CASHIER',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  const cashierUser = { id: cashierUserId, restaurantId, username: 'cashier-test' };
  await assert.rejects(
    () => processCommand({ actionId: randomUUID(), type: 'ADD_ITEM', payload: { tableId, menuItemId } } as any, cashierUser as any),
    /cashiers are only permitted/i,
    'cashier cannot mutate waiter order items'
  );

  const close = { actionId: randomUUID(), type: 'CLOSE_TABLE', payload: { tableId } };
  const closeFirst = await processCommand(close as any, cashierUser as any);
  const closeReplay = await processCommand(close as any, cashierUser as any);
  assert.equal(closeReplay.duplicate, true, 'replayed CLOSE_TABLE is idempotent');
  assert.equal(closeReplay.stateVersion, closeFirst.stateVersion, 'duplicate close does not increment the state version');
  const closedOrder = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get();
  const closedTable = await db.select().from(schema.tables).where(eq(schema.tables.id, tableId)).get();
  assert.equal(closedOrder.status, 'CLOSED', 'CLOSE_TABLE closes the active order');
  assert.equal(closedTable.status, 'EMPTY', 'CLOSE_TABLE frees the table');

  // Two clients racing to open the same EMPTY table must never create two OPEN orders.
  const raceTableId = randomUUID();
  await db.insert(schema.tables).values({
    id: raceTableId,
    number: 2,
    label: 'Concurrent open test',
    status: 'EMPTY',
    createdAt: now,
    updatedAt: now,
  });
  const raceCommands = [randomUUID(), randomUUID()].map(actionId => ({
    actionId,
    type: 'OPEN_TABLE',
    payload: { tableId: raceTableId, covers: 2, clientOrderId: randomUUID() }
  }));
  const raceResults = await Promise.allSettled(raceCommands.map(command => processCommand(command as any, user as any)));
  assert.equal(raceResults.filter(result => result.status === 'fulfilled').length, 1, 'only one concurrent OPEN_TABLE may succeed');
  assert.equal(raceResults.filter(result => result.status === 'rejected').length, 1, 'the competing OPEN_TABLE must be rejected');
  const raceOrders = await db.select().from(schema.orders).where(eq(schema.orders.tableId, raceTableId));
  assert.equal(raceOrders.filter((order: any) => order.status === 'OPEN').length, 1, 'concurrent opening leaves exactly one OPEN order');

  const otherUserId = randomUUID();
  await db.insert(schema.users).values({
    id: otherUserId,
    restaurantId,
    name: 'Second Test Owner',
    username: 'test_' + randomUUID().replace(/-/g, ''),
    passwordHash: 'not-a-real-login-hash',
    role: 'OWNER',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  await assert.rejects(
    () => processCommand(open as any, { ...user, id: otherUserId } as any),
    /different user or operation/,
    'another user cannot reuse an existing action ID'
  );

  console.log('PASS: command idempotency, concurrent table-open safety, actor-bound action IDs, stable offline IDs, replayed quantity, note update, and table close.');
} finally {
  if (dbModule?.client) {
    try { await dbModule.client.close(); } catch {}
  }

  // LibSQL's Windows native driver can briefly retain a file handle after close().
  // Retry transient Windows EBUSY/EPERM/ENOTEMPTY locks instead of failing the
  // behavioral test after all assertions already passed.
  let removed = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      fs.rmSync(testDataDir, { recursive: true, force: true });
      removed = true;
      break;
    } catch (error: any) {
      if (!['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(error?.code) || attempt === 9) {
        console.warn('Could not remove isolated test database directory:', error?.message || error);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  if (!removed && fs.existsSync(testDataDir)) {
    console.warn('Isolated test database directory remains locked; it contains generated test data only:', testDataDir);
  }
}
