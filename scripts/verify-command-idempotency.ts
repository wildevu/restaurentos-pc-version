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

  const note = {
    actionId: randomUUID(),
    type: 'SET_ITEM_NOTE',
    payload: { tableId, orderItemId: itemId, notes: 'verified note update' },
  };
  const noteResult = await processCommand(note as any, user as any);
  assert.equal(noteResult.success, true, 'queued note update accepts the stable client item ID');
  const notedItem = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, itemId)).get();
  assert.equal(notedItem.notes, 'verified note update', 'note update targeted the stable client item ID');

  const close = { actionId: randomUUID(), type: 'CLOSE_TABLE', payload: { tableId } };
  await processCommand(close as any, user as any);
  const closedOrder = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get();
  const closedTable = await db.select().from(schema.tables).where(eq(schema.tables.id, tableId)).get();
  assert.equal(closedOrder.status, 'CLOSED', 'CLOSE_TABLE closes the active order');
  assert.equal(closedTable.status, 'EMPTY', 'CLOSE_TABLE frees the table');

  console.log('PASS: command idempotency, stable offline IDs, replayed quantity, note update, and table close.');
} finally {
  if (dbModule?.client) {
    try { await dbModule.client.close(); } catch {}
  }
  fs.rmSync(testDataDir, { recursive: true, force: true });
}
