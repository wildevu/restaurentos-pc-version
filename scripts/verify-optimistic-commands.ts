import assert from 'node:assert/strict';
import { applyOptimisticCommand, rebasePendingCommands } from '../src/offline/optimistic';

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
assert.equal(state.orders[0].covers, 3, 'optimistic order must preserve selected guest count');

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

// An acknowledgement snapshot contains the committed action but not later
// pending actions. Rebase skips the committed action and replays the remainder.
const authoritativeAfterOpen = {
  tables: [{ ...table, status: 'ACTIVE', orderId: 'order-client-1', itemCount: 0 }],
  orders: [{
    id: 'order-client-1',
    tableId: 'table-1',
    tableNumber: 1,
    covers: 3,
    status: 'OPEN',
    items: []
  } as any]
};
const rebased = rebasePendingCommands(
  authoritativeAfterOpen as any,
  [
    { actionId: 'committed-open', type: 'OPEN_TABLE', payload: { tableId: 'table-1', covers: 3, clientOrderId: 'order-client-1' } },
    { actionId: 'pending-add', type: 'ADD_ITEM', payload: { tableId: 'table-1', menuItemId: 'menu-1', clientItemId: 'item-pending', name: 'Coffee', price: 250 } },
    { actionId: 'pending-increment', type: 'INCREMENT_ITEM', payload: { tableId: 'table-1', orderItemId: 'item-pending' } }
  ],
  'committed-open'
);
assert.equal(rebased.orders[0].items.length, 1, 'remaining pending ADD_ITEM is replayed after acknowledgement');
assert.equal(rebased.orders[0].items[0].quantity, 2, 'remaining pending INCREMENT_ITEM is replayed after acknowledgement');
assert.equal(rebased.tables[0].itemCount, 2, 'table item count is rebased with later pending commands');

console.log('Optimistic command workflow and acknowledgement rebase checks passed.');
