import { db } from './index';
import { tables, menuCategories, menuItems, orders, orderItems, auditEvents, idempotencyKeys, hubState, users, restaurants } from './schema';
import { eq, and, asc, sql, inArray, isNull } from 'drizzle-orm';
import { uuidv4 } from '../utils/uuid';
import { z } from 'zod';
import { 
  CommandPayloadSchema, 
  OpenTablePayload, 
  CloseTablePayload, 
  AddItemPayload, 
  UpdateItemPayload, 
  NoteItemPayload,
  UpdateKitchenStatusPayload,
  BatchUpdateKitchenStatusPayload
} from '../schemas';

export class CommandError extends Error {
  public isRetryable: boolean;
  constructor(message: string, isRetryable: boolean = false) {
    super(message);
    this.name = 'CommandError';
    this.isRetryable = isRetryable;
  }
}

async function getUniqueActiveOrderForTable(tx: any, tableId: string): Promise<any | null> {
  const matches = await tx.select().from(orders)
    .where(and(eq(orders.tableId, tableId), eq(orders.status, 'OPEN')))
    .limit(2);
  if (matches.length > 1) {
    throw new CommandError('This table has multiple active orders. Ask a manager to repair the table state before continuing.', false);
  }
  return matches[0] || null;
}

export async function getFrontendStateTx(tx: any, stateVersion?: number) {
  const allTables = await tx.select().from(tables).orderBy(asc(tables.displayOrder), asc(tables.number));
  const activeOrders = await tx.select().from(orders).where(eq(orders.status, 'OPEN'));
  const activeOrderIds = activeOrders.map((o: any) => o.id);

  let activeOrderItems: any[] = [];
  if (activeOrderIds.length > 0) {
    activeOrderItems = await tx.select().from(orderItems).where(inArray(orderItems.orderId, activeOrderIds));
  }

  // Fetch all users to populate user names
  const allUsers = await tx.select({ id: users.id, name: users.name, role: users.role }).from(users);
  const userMap = new Map(allUsers.map((u: any) => [u.id, u.name]));

  const allCategories = await tx.select().from(menuCategories).where(isNull(menuCategories.archivedAt)).orderBy(asc(menuCategories.displayOrder));
  const allItems = await tx.select().from(menuItems).where(and(eq(menuItems.isAvailable, true), isNull(menuItems.archivedAt))).orderBy(asc(menuItems.displayOrder));

  return {
    stateVersion,
    tables: allTables.map((t: any) => {
      const order = activeOrders.find((o: any) => o.tableId === t.id);
      const itemsForTable = order ? activeOrderItems.filter((i: any) => i.orderId === order.id) : [];
      const itemCount = itemsForTable.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);
      
      return {
        id: t.id,
        number: t.number,
        label: t.label,
        section: t.section || 'Main Dining',
        displayOrder: t.displayOrder || 0,
        status: t.status,
        orderId: order?.id || null,
        itemCount,
        archivedAt: t.archivedAt ? t.archivedAt.toISOString() : null
      };
    }),
    orders: activeOrders.map((o: any) => {
      const table = allTables.find((t: any) => t.id === o.tableId);
      const items = activeOrderItems.filter((i: any) => i.orderId === o.id).map((i: any) => ({
        id: i.id,
        orderId: i.orderId,
        menuItemId: i.menuItemId,
        name: i.productNameSnapshot,
        price: i.unitPriceSnapshot,
        quantity: i.quantity,
        notes: i.notes || null,
        kitchenStatus: i.kitchenStatus || 'PENDING',
        kitchenStatusUpdatedAt: i.kitchenStatusUpdatedAt ? (i.kitchenStatusUpdatedAt instanceof Date ? i.kitchenStatusUpdatedAt.toISOString() : new Date(i.kitchenStatusUpdatedAt).toISOString()) : null,
        addedByUserId: i.addedByUserId,
        addedByUserName: i.addedByUserId ? userMap.get(i.addedByUserId) || 'Staff' : null,
        createdAt: i.createdAt ? (i.createdAt instanceof Date ? i.createdAt.toISOString() : new Date(i.createdAt).toISOString()) : null
      }));

      return {
        id: o.id,
        tableId: o.tableId,
        tableNumber: table?.number,
        tableLabel: table?.label,
        tableSection: table?.section || 'Main Dining',
        covers: o.covers || 1,
        status: o.status,
        currencySnapshot: o.currencySnapshot || 'USD',
        openedByUserId: o.openedByUserId,
        openedByUserName: o.openedByUserId ? userMap.get(o.openedByUserId) || 'Staff' : null,
        createdAt: o.createdAt ? (o.createdAt instanceof Date ? o.createdAt.toISOString() : new Date(o.createdAt).toISOString()) : new Date().toISOString(),
        updatedAt: o.updatedAt ? (o.updatedAt instanceof Date ? o.updatedAt.toISOString() : new Date(o.updatedAt).toISOString()) : null,
        items
      };
    }),
    menu: allCategories.map((c: any) => ({
      id: c.id,
      name: c.name,
      displayOrder: c.displayOrder,
      items: allItems.filter((i: any) => i.categoryId === c.id).map((i: any) => ({
        id: i.id,
        categoryId: i.categoryId,
        name: i.name,
        price: i.price,
        description: i.description,
        isAvailable: i.isAvailable
      }))
    })),
    restaurant: await (async () => {
      const r = await tx.select().from(restaurants).get();
      return r ? {
        id: r.id,
        name: r.name,
        language: r.language || 'en',
        currency: r.currency || 'USD',
        timezone: r.timezone || 'UTC',
        logo: r.logo || null
      } : null;
    })()
  };
}

function isSqliteLockContention(error: any): boolean {
  const code = String(error?.code || error?.cause?.code || '').toUpperCase();
  const message = String(error?.message || error?.cause?.message || error || '');
  return /SQLITE_(BUSY|LOCKED)/.test(code) ||
    /SQLITE_(BUSY|LOCKED)|database is locked|database table is locked/i.test(message);
}

async function runTransactionWithRetry<T>(
  fn: (tx: any) => Promise<T>,
  retries = 5
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await db.transaction(fn, { behavior: 'immediate' });
    } catch (err: any) {
      if (isSqliteLockContention(err)) {
        await new Promise(r => setTimeout(r, 50 * Math.pow(2, i)));
        continue;
      }
      throw err;
    }
  }
  throw new CommandError('Database transaction failed after retries due to lock contention', true);
}

export async function processCommand(command: z.infer<typeof CommandPayloadSchema>, user: any, clientInstallationId?: string) {
  return await runTransactionWithRetry(async (tx) => {
    const now = new Date();
    
    // Check if user is active
    const dbUser = await tx.select().from(users).where(eq(users.id, user.id)).get();
    if (!dbUser || !dbUser.isActive) {
      throw new CommandError('User account is deactivated', false);
    }

    // Role-based command access enforcement
    if (dbUser.role === 'CASHIER') {
      if (command.type !== 'CLOSE_TABLE') {
        throw new CommandError('Cashiers are only permitted to perform operational table clearance / settlement (CLOSE_TABLE)', false);
      }
    }

    if (dbUser.role === 'KITCHEN') {
      if (command.type !== 'UPDATE_ITEM_KITCHEN_STATUS' && command.type !== 'BATCH_UPDATE_KITCHEN_STATUS') {
        throw new CommandError('Kitchen staff are only permitted to update kitchen preparation statuses', false);
      }
    }

    if (dbUser.role === 'WAITER') {
      // Preserve all existing waiter operations. The only kitchen-related
      // command permitted to waiters is marking an already-ready item as served.
      if (command.type === 'BATCH_UPDATE_KITCHEN_STATUS') {
        throw new CommandError('Waiters cannot perform bulk kitchen status changes', false);
      }
      if (command.type === 'UPDATE_ITEM_KITCHEN_STATUS') {
        const waiterStatusPayload = UpdateKitchenStatusPayload.parse(command.payload);
        if (waiterStatusPayload.status !== 'SERVED') {
          throw new CommandError('Waiters may only mark ready items as served', false);
        }
      }
    }
    
    // 1. Idempotency Check & Claim (Atomic within the transaction)
    const res = await tx.insert(idempotencyKeys).values({
      id: command.actionId,
      restaurantId: user.restaurantId,
      actorUserId: user.id,
      operation: command.type,
      createdAt: now,
      stateVersion: null
    }).onConflictDoNothing().run();

    if (res.rowsAffected === 0) {
      // Duplicate! It must have been committed by a previous transaction.
      const existing = await tx.select().from(idempotencyKeys)
        .where(and(eq(idempotencyKeys.restaurantId, user.restaurantId), eq(idempotencyKeys.id, command.actionId)))
        .get();
      
      if (existing && (existing.actorUserId !== user.id || existing.operation !== command.type)) {
        throw new CommandError('Action ID was already used by a different user or operation', false);
      }
      if (existing && existing.stateVersion !== null) {
        // A retry can arrive after the original acknowledgement or broadcast was
        // lost. Return the current authoritative state, not just "duplicate",
        // so the client can recover without waiting for another reconnect.
        const currentStateRow = await tx.select().from(hubState)
          .where(eq(hubState.restaurantId, user.restaurantId)).get();
        const currentVersion = currentStateRow?.version ?? existing.stateVersion;
        return {
          success: true,
          duplicate: true,
          actionId: command.actionId,
          stateVersion: currentVersion,
          state: await getFrontendStateTx(tx, currentVersion)
        };
      } else {
        throw new CommandError('Command found in invalid state', true);
      }
    }

    // 2. Business Logic
    switch (command.type) {
      case 'OPEN_TABLE': {
        const parsedPayload = OpenTablePayload.parse(command.payload);
        const { tableId } = parsedPayload;
        const covers = parsedPayload.covers || 1;
        const t = await tx.select().from(tables).where(eq(tables.id, tableId)).get();
        if (!t) throw new CommandError('Table not found');
        if (t.archivedAt) throw new CommandError('Archived tables cannot be opened. Refresh the table list.');
        if (t.status !== 'EMPTY') throw new CommandError('Table is already active');
        const orphanedActiveOrders = await tx.select({ id: orders.id }).from(orders)
          .where(and(eq(orders.tableId, tableId), eq(orders.status, 'OPEN')))
          .limit(1);
        if (orphanedActiveOrders.length > 0) {
          throw new CommandError('This table already has an active order in the database. Refresh the POS and ask a manager to review the table state.', false);
        }

        await tx.update(tables).set({ status: 'ACTIVE', updatedAt: now }).where(eq(tables.id, tableId));
        const rest = await tx.select().from(restaurants).get();
        const orderId = parsedPayload.clientOrderId || uuidv4();
        await tx.insert(orders).values({
          id: orderId,
          tableId,
          covers,
          status: 'OPEN',
          currencySnapshot: rest?.currency || 'USD',
          openedByUserId: user.id,
          createdAt: now,
          updatedAt: now
        });
        
        await tx.insert(auditEvents).values({
          id: uuidv4(),
          restaurantId: user.restaurantId,
          actorUserId: user.id,
          actorClientInstallationId: clientInstallationId || null,
          action: 'TABLE_OPENED',
          entityType: 'TABLE',
          entityId: tableId,
          metadata: JSON.stringify({ orderId, tableNumber: t.number }),
          createdAt: now
        });
        break;
      }
      
      case 'CLOSE_TABLE': {
        const { tableId } = CloseTablePayload.parse(command.payload);
        const activeOrder = await getUniqueActiveOrderForTable(tx, tableId);
        if (!activeOrder) throw new CommandError('No active order for this table');
        const activeTable = await tx.select().from(tables).where(eq(tables.id, tableId)).get();
        if (!activeTable || activeTable.status !== 'ACTIVE') {
          throw new CommandError('Table state is inconsistent with its active order. Refresh the POS and ask a manager to review it.', false);
        }
        await tx.update(orders).set({ status: 'CLOSED', closedByUserId: user.id, updatedAt: now }).where(eq(orders.id, activeOrder.id));
        await tx.update(tables).set({ status: 'EMPTY', updatedAt: now }).where(eq(tables.id, tableId));
        
        await tx.insert(auditEvents).values({
          id: uuidv4(),
          restaurantId: user.restaurantId,
          actorUserId: user.id,
          actorClientInstallationId: clientInstallationId || null,
          action: 'ORDER_CLOSED',
          entityType: 'ORDER',
          entityId: activeOrder.id,
          metadata: JSON.stringify({ tableId }),
          createdAt: now
        });
        break;
      }
      
      case 'ADD_ITEM': {
        const { tableId, menuItemId, notes, clientItemId } = AddItemPayload.parse(command.payload);
        const activeOrder = await getUniqueActiveOrderForTable(tx, tableId);
        if (!activeOrder) throw new CommandError('No active order for this table');
        
        const menuItem = await tx.select().from(menuItems).where(eq(menuItems.id, menuItemId)).get();
        if (!menuItem || !menuItem.isAvailable || menuItem.archivedAt) {
          throw new CommandError('Menu item not available');
        }

        // If notes are provided, or if no matching item without notes exists, insert new orderItem
        const trimmedNotes = notes ? notes.trim() : null;
        let existingItem = null;

        if (!trimmedNotes) {
          existingItem = await tx.select().from(orderItems).where(
            and(
              eq(orderItems.orderId, activeOrder.id), 
              eq(orderItems.menuItemId, menuItemId), 
              sql`${orderItems.notes} IS NULL OR ${orderItems.notes} = ''`
            )
          ).get();
        }

        let orderItemId;
        if (existingItem) {
          orderItemId = existingItem.id;
          await tx.update(orderItems)
            .set({ quantity: sql`${orderItems.quantity} + 1`, updatedAt: now })
            .where(eq(orderItems.id, orderItemId));
          
          await tx.insert(auditEvents).values({
            id: uuidv4(),
            restaurantId: user.restaurantId,
            actorUserId: user.id,
            actorClientInstallationId: clientInstallationId || null,
            action: 'ITEM_INCREMENTED',
            entityType: 'ORDER_ITEM',
            entityId: orderItemId,
            metadata: JSON.stringify({ menuItemId, name: menuItem.name }),
            createdAt: now
          });
        } else {
          orderItemId = clientItemId || uuidv4();
          await tx.insert(orderItems).values({
            id: orderItemId,
            orderId: activeOrder.id,
            menuItemId,
            productNameSnapshot: menuItem.name,
            unitPriceSnapshot: menuItem.price,
            quantity: 1,
            notes: trimmedNotes,
            kitchenStatus: 'PENDING',
            kitchenStatusUpdatedAt: now,
            addedByUserId: user.id,
            createdAt: now,
            updatedAt: now
          });
          
          await tx.insert(auditEvents).values({
            id: uuidv4(),
            restaurantId: user.restaurantId,
            actorUserId: user.id,
            actorClientInstallationId: clientInstallationId || null,
            action: 'ITEM_ADDED',
            entityType: 'ORDER_ITEM',
            entityId: orderItemId,
            metadata: JSON.stringify({ menuItemId, name: menuItem.name, notes: trimmedNotes }),
            createdAt: now
          });
        }
        break;
      }
      
      case 'INCREMENT_ITEM': {
        const { tableId, orderItemId } = UpdateItemPayload.parse(command.payload);
        const activeOrder = await getUniqueActiveOrderForTable(tx, tableId);
        if (!activeOrder) throw new CommandError('No active open order for this table');

        const item = await tx.select().from(orderItems).where(and(eq(orderItems.id, orderItemId), eq(orderItems.orderId, activeOrder.id))).get();
        if (!item) throw new CommandError('Item not found on active order');
        
        await tx.update(orderItems)
          .set({ quantity: sql`${orderItems.quantity} + 1`, updatedAt: now })
          .where(eq(orderItems.id, orderItemId));
          
        await tx.insert(auditEvents).values({
          id: uuidv4(),
          restaurantId: user.restaurantId,
          actorUserId: user.id,
          actorClientInstallationId: clientInstallationId || null,
          action: 'ITEM_INCREMENTED',
          entityType: 'ORDER_ITEM',
          entityId: orderItemId,
          metadata: JSON.stringify({ name: item.productNameSnapshot, newQuantity: item.quantity + 1 }),
          createdAt: now
        });
        break;
      }
      
      case 'DECREMENT_ITEM': {
        const { tableId, orderItemId } = UpdateItemPayload.parse(command.payload);
        const activeOrder = await getUniqueActiveOrderForTable(tx, tableId);
        if (!activeOrder) throw new CommandError('No active open order for this table');

        const item = await tx.select().from(orderItems).where(and(eq(orderItems.id, orderItemId), eq(orderItems.orderId, activeOrder.id))).get();
        if (!item) throw new CommandError('Item not found on active order');
        
        if (item.quantity <= 1) {
          await tx.delete(orderItems).where(eq(orderItems.id, orderItemId));
          await tx.insert(auditEvents).values({
            id: uuidv4(),
            restaurantId: user.restaurantId,
            actorUserId: user.id,
            actorClientInstallationId: clientInstallationId || null,
            action: 'ITEM_REMOVED',
            entityType: 'ORDER_ITEM',
            entityId: orderItemId,
            metadata: JSON.stringify({ reason: 'quantity_reached_zero', name: item.productNameSnapshot, previousQuantity: item.quantity }),
            createdAt: now
          });
        } else {
          await tx.update(orderItems)
            .set({ quantity: sql`${orderItems.quantity} - 1`, updatedAt: now })
            .where(eq(orderItems.id, orderItemId));
          await tx.insert(auditEvents).values({
            id: uuidv4(),
            restaurantId: user.restaurantId,
            actorUserId: user.id,
            actorClientInstallationId: clientInstallationId || null,
            action: 'ITEM_DECREMENTED',
            entityType: 'ORDER_ITEM',
            entityId: orderItemId,
            metadata: JSON.stringify({ name: item.productNameSnapshot, newQuantity: item.quantity - 1 }),
            createdAt: now
          });
        }
        break;
      }
      
      case 'REMOVE_ITEM': {
        const { tableId, orderItemId } = UpdateItemPayload.parse(command.payload);
        const activeOrder = await getUniqueActiveOrderForTable(tx, tableId);
        if (!activeOrder) throw new CommandError('No active open order for this table');

        const item = await tx.select().from(orderItems).where(and(eq(orderItems.id, orderItemId), eq(orderItems.orderId, activeOrder.id))).get();
        if (!item) throw new CommandError('Item not found on active order');
        
        await tx.delete(orderItems).where(eq(orderItems.id, orderItemId));
        await tx.insert(auditEvents).values({
          id: uuidv4(),
          restaurantId: user.restaurantId,
          actorUserId: user.id,
          actorClientInstallationId: clientInstallationId || null,
          action: 'ITEM_REMOVED',
          entityType: 'ORDER_ITEM',
          entityId: orderItemId,
          metadata: JSON.stringify({ reason: 'explicit_remove', name: item.productNameSnapshot, previousQuantity: item.quantity }),
          createdAt: now
        });
        break;
      }
      
      case 'SET_ITEM_NOTE': {
        const { tableId, orderItemId, notes } = NoteItemPayload.parse(command.payload);
        const activeOrder = await getUniqueActiveOrderForTable(tx, tableId);
        if (!activeOrder) throw new CommandError('No active open order for this table');

        const item = await tx.select().from(orderItems).where(and(eq(orderItems.id, orderItemId), eq(orderItems.orderId, activeOrder.id))).get();
        if (!item) throw new CommandError('Item not found on active order');
        
        const cleanNotes = notes ? notes.trim() : null;
        await tx.update(orderItems)
          .set({ notes: cleanNotes, updatedAt: now })
          .where(eq(orderItems.id, orderItemId));

        await tx.insert(auditEvents).values({
          id: uuidv4(),
          restaurantId: user.restaurantId,
          actorUserId: user.id,
          actorClientInstallationId: clientInstallationId || null,
          action: 'ITEM_NOTE_UPDATED',
          entityType: 'ORDER_ITEM',
          entityId: orderItemId,
          metadata: JSON.stringify({ name: item.productNameSnapshot, notes: cleanNotes }),
          createdAt: now
        });
        break;
      }

      case 'UPDATE_ITEM_KITCHEN_STATUS': {
        const { orderItemId, status } = UpdateKitchenStatusPayload.parse(command.payload);
        const item = await tx.select().from(orderItems).where(eq(orderItems.id, orderItemId)).get();
        if (!item) throw new CommandError('Order item not found');
        const parentOrder = await tx.select().from(orders)
          .where(and(eq(orders.id, item.orderId), eq(orders.status, 'OPEN'))).get();
        if (!parentOrder) throw new CommandError('Order item is not part of an active order');

        const prevStatus = item.kitchenStatus;
        if (dbUser.role === 'WAITER' && (prevStatus !== 'READY' || status !== 'SERVED')) {
          throw new CommandError('Waiters can only mark READY items as SERVED', false);
        }
        await tx.update(orderItems)
          .set({ kitchenStatus: status, kitchenStatusUpdatedAt: now, updatedAt: now })
          .where(eq(orderItems.id, orderItemId));

        await tx.insert(auditEvents).values({
          id: uuidv4(),
          restaurantId: user.restaurantId,
          actorUserId: user.id,
          actorClientInstallationId: clientInstallationId || null,
          action: 'KITCHEN_STATUS_UPDATED',
          entityType: 'ORDER_ITEM',
          entityId: orderItemId,
          metadata: JSON.stringify({ previousStatus: prevStatus, newStatus: status, productName: item.productNameSnapshot }),
          createdAt: now
        });
        break;
      }

      case 'BATCH_UPDATE_KITCHEN_STATUS': {
        const { orderId, orderItemIds, status } = BatchUpdateKitchenStatusPayload.parse(command.payload);
        let candidateItems: any[] = [];
        if (orderId) {
          const activeOrder = await tx.select({ id: orders.id }).from(orders)
            .where(and(eq(orders.id, orderId), eq(orders.status, 'OPEN'))).get();
          if (!activeOrder) throw new CommandError('Order is not active');
          const conditions = orderItemIds && orderItemIds.length > 0
            ? and(eq(orderItems.orderId, orderId), inArray(orderItems.id, orderItemIds))
            : eq(orderItems.orderId, orderId);
          candidateItems = await tx.select({
            id: orderItems.id,
            kitchenStatus: orderItems.kitchenStatus
          }).from(orderItems).where(conditions);
        } else if (orderItemIds && orderItemIds.length > 0) {
          const activeOrders = await tx.select({ id: orders.id }).from(orders)
            .where(eq(orders.status, 'OPEN'));
          const activeOrderIds = activeOrders.map((order: any) => order.id);
          if (activeOrderIds.length > 0) {
            candidateItems = await tx.select({
              id: orderItems.id,
              kitchenStatus: orderItems.kitchenStatus
            }).from(orderItems).where(and(
              inArray(orderItems.id, orderItemIds),
              inArray(orderItems.orderId, activeOrderIds)
            ));
          }
        }

        // Never silently apply a partial batch. A stale or foreign item ID must
        // reject the entire operation so staff are not told every item changed.
        if (orderItemIds && orderItemIds.length > 0) {
          const requestedIds = new Set(orderItemIds);
          if (requestedIds.size !== orderItemIds.length || candidateItems.length !== requestedIds.size) {
            throw new CommandError('One or more selected order items are missing, duplicated, or no longer part of an active order. Refresh the kitchen display and retry.', false);
          }
        }

        // A bulk READY action must not undo an item's SERVED state.
        const targetItemIds = candidateItems
          .filter((item: any) => status !== 'READY' || item.kitchenStatus !== 'SERVED')
          .map((item: any) => item.id);

        if (targetItemIds.length > 0) {
          await tx.update(orderItems)
            .set({ kitchenStatus: status, kitchenStatusUpdatedAt: now, updatedAt: now })
            .where(inArray(orderItems.id, targetItemIds));

          await tx.insert(auditEvents).values({
            id: uuidv4(),
            restaurantId: user.restaurantId,
            actorUserId: user.id,
            actorClientInstallationId: clientInstallationId || null,
            action: 'BATCH_KITCHEN_STATUS_UPDATED',
            entityType: 'ORDER',
            entityId: orderId || targetItemIds[0],
            metadata: JSON.stringify({ newStatus: status, itemCount: targetItemIds.length }),
            createdAt: now
          });
        }
        break;
      }

      default:
        throw new CommandError('Unknown command type', false);
    }
      
    // 3. Update Hub State Version
    const versionRes = await tx.update(hubState)
      .set({ version: sql`${hubState.version} + 1`, updatedAt: now })
      .where(eq(hubState.restaurantId, user.restaurantId))
      .returning({ version: hubState.version })
      .get();

    let stateVersion = versionRes?.version;
    if (stateVersion === undefined) {
      stateVersion = 1;
      await tx.insert(hubState).values({ restaurantId: user.restaurantId, version: stateVersion, updatedAt: now });
    }

    // 4. Record successful idempotency completion
    await tx.update(idempotencyKeys)
      .set({ stateVersion })
      .where(and(eq(idempotencyKeys.restaurantId, user.restaurantId), eq(idempotencyKeys.id, command.actionId)));

    return { 
      success: true, 
      duplicate: false, 
      actionId: command.actionId, 
      stateVersion, 
      state: await getFrontendStateTx(tx, stateVersion) 
    };
  });
}
