import assert from 'node:assert/strict';
import { applyOptimisticCommand } from '../src/offline/optimistic';

const table: any = {
  id: 'table-1',
  number: 1,
  status: 'EMPTY',
  orderId: null,
  itemCount: 0
};

let state = { tables: [table], orders: [] as any[] };
state = applyOptimisticCommand(state, 'OPEN_TABLE', {
  tableId: 'table-1',
  covers: 3,
  clientOrderId: 'order-client-1'
});

assert.equal(state.tables[0].status, 'ACTIVE', 'OPEN_TABLE must activate the table');
assert.equal(state.tables[0].orderId, 'order-client-1', 'table must point to the optimistic order');
assert.equal(state.orders.length, 1, 'OPEN_TABLE must create its optimistic order');
assert.equal(state.orders[0].id, state.tables[0].orderId, 'table and order IDs must match');
assert.equal(state.orders[0].tableId, 'table-1', 'order must belong to the opened table');

state = applyOptimisticCommand(state, 'ADD_ITEM', {
  tableId: 'table-1',
  menuItemId: 'menu-1',
  clientItemId: 'item-client-1',
  name: 'Coffee',
  price: 250
});
assert.equal(state.orders[0].items.length, 1, 'ADD_ITEM must append an item to the active order');
assert.equal(state.orders[0].items[0].id, 'item-client-1', 'optimistic item ID must be stable');
assert.equal(state.tables[0].itemCount, 1, 'table item count must follow the order');

state = applyOptimisticCommand(state, 'INCREMENT_ITEM', {
  tableId: 'table-1',
  orderItemId: 'item-client-1'
});
assert.equal(state.orders[0].items[0].quantity, 2, 'INCREMENT_ITEM must update quantity');
assert.equal(state.tables[0].itemCount, 2, 'table item count must stay consistent');

state = applyOptimisticCommand(state, 'CLOSE_TABLE', { tableId: 'table-1' });
assert.equal(state.tables[0].status, 'EMPTY', 'CLOSE_TABLE must return the table to EMPTY');
assert.equal(state.tables[0].orderId, null, 'closed table must not retain an order ID');
assert.equal(state.orders.length, 0, 'closed table must remove its open order');

console.log('Optimistic command workflow checks passed.');
