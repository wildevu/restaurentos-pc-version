import { Table, Order } from '../types';
import { uuidv4 } from '../utils/uuid';

export function applyOptimisticCommand(
  state: { tables: Table[], orders: Order[] },
  type: string,
  payload: any
): { tables: Table[], orders: Order[] } {
  const tables = [...state.tables];
  const orders = [...state.orders];
  
  try {
    switch (type) {
      case 'OPEN_TABLE': {
        const tableIdx = tables.findIndex(t => t.id === payload.tableId);
        if (tableIdx > -1) {
          const newOrderId = 'opt_' + uuidv4();
          tables[tableIdx] = { 
            ...tables[tableIdx], 
            status: 'ACTIVE',
            orderId: newOrderId,
            itemCount: 0
          };
          orders.push({
            id: newOrderId,
            tableId: payload.tableId,
            tableNumber: tables[tableIdx].number,
            status: 'OPEN',
            openedByUserId: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: []
          });
        }
        break;
      }
      case 'CLOSE_TABLE': {
        const tableIdx = tables.findIndex(t => t.id === payload.tableId);
        if (tableIdx > -1) {
          tables[tableIdx] = { ...tables[tableIdx], status: 'EMPTY', orderId: null, itemCount: 0 };
        }
        const openOrderIdx = orders.findIndex(o => o.tableId === payload.tableId && o.status === 'OPEN');
        if (openOrderIdx > -1) {
          orders.splice(openOrderIdx, 1);
        }
        break;
      }
      case 'ADD_ITEM': {
        const orderIdx = orders.findIndex(o => o.tableId === payload.tableId && o.status === 'OPEN');
        if (orderIdx > -1) {
          const newOrder = { ...orders[orderIdx], items: [...(orders[orderIdx].items || [])] };
          const notes = payload.notes ? payload.notes.trim() : null;
          
          // Try to find if already exists with exact same notes
          const existingItemIdx = newOrder.items.findIndex(i => i.menuItemId === payload.menuItemId && (i.notes || null) === notes);
          if (existingItemIdx > -1 && !notes) {
             newOrder.items[existingItemIdx] = { 
               ...newOrder.items[existingItemIdx], 
               quantity: newOrder.items[existingItemIdx].quantity + 1 
             };
          } else {
             newOrder.items.push({
               id: 'opt_' + uuidv4(),
               orderId: newOrder.id,
               menuItemId: payload.menuItemId,
               name: payload.name || 'Item',
               price: payload.price || 0,
               quantity: 1,
               notes: notes,
               kitchenStatus: 'PENDING',
               kitchenStatusUpdatedAt: new Date().toISOString(),
               createdAt: new Date().toISOString()
             });
          }
          orders[orderIdx] = newOrder;

          // Update table itemCount
          const tableIdx = tables.findIndex(t => t.id === payload.tableId);
          if (tableIdx > -1) {
            const count = newOrder.items.reduce((s, i) => s + i.quantity, 0);
            tables[tableIdx] = { ...tables[tableIdx], itemCount: count };
          }
        }
        break;
      }
      case 'INCREMENT_ITEM': {
        const orderIdx = orders.findIndex(o => o.tableId === payload.tableId && o.status === 'OPEN');
        if (orderIdx > -1) {
          const newOrder = { ...orders[orderIdx], items: [...(orders[orderIdx].items || [])] };
          const itemIdx = newOrder.items.findIndex(i => i.id === payload.orderItemId);
          if (itemIdx > -1) {
            newOrder.items[itemIdx] = { ...newOrder.items[itemIdx], quantity: newOrder.items[itemIdx].quantity + 1 };
          }
          orders[orderIdx] = newOrder;

          const tableIdx = tables.findIndex(t => t.id === payload.tableId);
          if (tableIdx > -1) {
            const count = newOrder.items.reduce((s, i) => s + i.quantity, 0);
            tables[tableIdx] = { ...tables[tableIdx], itemCount: count };
          }
        }
        break;
      }
      case 'DECREMENT_ITEM': {
        const orderIdx = orders.findIndex(o => o.tableId === payload.tableId && o.status === 'OPEN');
        if (orderIdx > -1) {
          const newOrder = { ...orders[orderIdx], items: [...(orders[orderIdx].items || [])] };
          const itemIdx = newOrder.items.findIndex(i => i.id === payload.orderItemId);
          if (itemIdx > -1) {
            if (newOrder.items[itemIdx].quantity <= 1) {
              newOrder.items.splice(itemIdx, 1);
            } else {
              newOrder.items[itemIdx] = { ...newOrder.items[itemIdx], quantity: newOrder.items[itemIdx].quantity - 1 };
            }
          }
          orders[orderIdx] = newOrder;

          const tableIdx = tables.findIndex(t => t.id === payload.tableId);
          if (tableIdx > -1) {
            const count = newOrder.items.reduce((s, i) => s + i.quantity, 0);
            tables[tableIdx] = { ...tables[tableIdx], itemCount: count };
          }
        }
        break;
      }
      case 'REMOVE_ITEM': {
        const orderIdx = orders.findIndex(o => o.tableId === payload.tableId && o.status === 'OPEN');
        if (orderIdx > -1) {
          const newOrder = { ...orders[orderIdx], items: [...(orders[orderIdx].items || [])] };
          const itemIdx = newOrder.items.findIndex(i => i.id === payload.orderItemId);
          if (itemIdx > -1) {
            newOrder.items.splice(itemIdx, 1);
          }
          orders[orderIdx] = newOrder;

          const tableIdx = tables.findIndex(t => t.id === payload.tableId);
          if (tableIdx > -1) {
            const count = newOrder.items.reduce((s, i) => s + i.quantity, 0);
            tables[tableIdx] = { ...tables[tableIdx], itemCount: count };
          }
        }
        break;
      }
      case 'SET_ITEM_NOTE': {
        const orderIdx = orders.findIndex(o => o.tableId === payload.tableId && o.status === 'OPEN');
        if (orderIdx > -1) {
          const newOrder = { ...orders[orderIdx], items: [...(orders[orderIdx].items || [])] };
          const itemIdx = newOrder.items.findIndex(i => i.id === payload.orderItemId);
          if (itemIdx > -1) {
             newOrder.items[itemIdx] = { ...newOrder.items[itemIdx], notes: payload.notes };
          }
          orders[orderIdx] = newOrder;
        }
        break;
      }
      case 'UPDATE_ITEM_KITCHEN_STATUS': {
        for (let oIdx = 0; oIdx < orders.length; oIdx++) {
          const items = [...orders[oIdx].items];
          const itemIdx = items.findIndex(i => i.id === payload.orderItemId);
          if (itemIdx > -1) {
            items[itemIdx] = {
              ...items[itemIdx],
              kitchenStatus: payload.status,
              kitchenStatusUpdatedAt: new Date().toISOString()
            };
            orders[oIdx] = { ...orders[oIdx], items };
            break;
          }
        }
        break;
      }
      case 'BATCH_UPDATE_KITCHEN_STATUS': {
        for (let oIdx = 0; oIdx < orders.length; oIdx++) {
          if (payload.orderId && orders[oIdx].id !== payload.orderId) continue;
          const items = orders[oIdx].items.map(i => {
            if (!payload.orderItemIds || payload.orderItemIds.includes(i.id)) {
              return { ...i, kitchenStatus: payload.status, kitchenStatusUpdatedAt: new Date().toISOString() };
            }
            return i;
          });
          orders[oIdx] = { ...orders[oIdx], items };
        }
        break;
      }
    }
  } catch (err) {
    console.error('Optimistic apply failed', err);
  }
  return { tables, orders };
}
