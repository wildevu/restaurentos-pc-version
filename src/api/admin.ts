import { Router } from 'express';
import { db } from '../db/index';
import { users, restaurants, tables, auditEvents, hubState, sessions, devices, pairingTokens, menuCategories, menuItems, orders, orderItems } from '../db/schema';
import { eq, and, not, sql, isNull, asc, desc, inArray, gte, lte, like } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { uuidv4 } from '../utils/uuid';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { hashToken } from '../crypto';
import { getFrontendStateTx } from '../db/queries';
import { BACKUP_DIR, DB_PATH, ensureDirectories } from '../paths';

export const adminRouter = Router();

// Middleware to check admin role
adminRouter.use((req: any, res: any, next) => {
  const user = req.user;
  if (!user || (user.role !== 'OWNER' && user.role !== 'MANAGER')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// Helper for emitting state updates
export async function emitStateUpdate(io: any, restaurantId: string) {
  if (!io) return;
  await db.transaction(async (tx: any) => {
    const now = new Date();
    const versionRes = await tx.update(hubState)
      .set({ version: sql`${hubState.version} + 1`, updatedAt: now })
      .where(eq(hubState.restaurantId, restaurantId))
      .returning({ version: hubState.version })
      .get();
    
    let stateVersion = versionRes?.version;
    if (!stateVersion) {
      stateVersion = 1;
      await tx.insert(hubState).values({ restaurantId, version: stateVersion, updatedAt: now });
    }
    
    const state = await getFrontendStateTx(tx, stateVersion);
    io.emit('STATE_UPDATE', state);
  }, { behavior: 'immediate' });
}

// RESTAURANT PROFILE
adminRouter.get('/restaurant', async (req: any, res) => {
  try {
    const restaurant = await db.select().from(restaurants).where(eq(restaurants.id, req.user.restaurantId)).get();
    res.json(restaurant);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.put('/restaurant', async (req: any, res) => {
  try {
    if (req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only owners can update restaurant settings' });
    }
    const schema = z.object({
      name: z.string().min(1),
      language: z.enum(['en', 'fr']).optional().default('en'),
      currency: z.string().min(1),
      timezone: z.string().min(1),
      logo: z.string().nullable().optional(),
    });
    const parsed = schema.parse(req.body);
    
    await db.update(restaurants)
      .set({ ...parsed, updatedAt: new Date() })
      .where(eq(restaurants.id, req.user.restaurantId));
      
    await db.insert(auditEvents).values({
      id: uuidv4(),
      restaurantId: req.user.restaurantId,
      actorUserId: req.user.id,
      action: 'RESTAURANT_UPDATED',
      metadata: JSON.stringify({ name: parsed.name, language: parsed.language, currency: parsed.currency, timezone: parsed.timezone }),
      createdAt: new Date(),
    });

    const io = req.app?.get('io');
    if (io) {
      await emitStateUpdate(io, req.user.restaurantId);
    }
    
    res.json({ success: true, restaurant: parsed });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// STAFF MANAGEMENT
adminRouter.get('/staff', async (req: any, res) => {
  try {
    const staff = await db.select({
      id: users.id,
      name: users.name,
      username: users.username,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt
    }).from(users).where(eq(users.restaurantId, req.user.restaurantId));
    res.json(staff);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.post('/staff', async (req: any, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      username: z.string().min(1),
      password: z.string().min(6),
      role: z.enum(['MANAGER', 'WAITER', 'KITCHEN', 'CASHIER']) // Cannot create OWNER
    });
    const parsed = schema.parse(req.body);
    
    if (req.user.role === 'MANAGER' && parsed.role === 'MANAGER') {
      return res.status(403).json({ error: 'Managers cannot create other managers' });
    }
    
    const existing = await db.select().from(users).where(eq(users.username, parsed.username)).get();
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const passwordHash = await bcrypt.hash(parsed.password, 10);
    const id = uuidv4();
    
    await db.insert(users).values({
      id,
      restaurantId: req.user.restaurantId,
      name: parsed.name,
      username: parsed.username,
      passwordHash,
      role: parsed.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    await db.insert(auditEvents).values({
      id: uuidv4(),
      restaurantId: req.user.restaurantId,
      actorUserId: req.user.id,
      action: 'STAFF_CREATED',
      entityType: 'USER',
      entityId: id,
      metadata: JSON.stringify({ role: parsed.role }),
      createdAt: new Date(),
    });
    
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.put('/staff/:id', async (req: any, res) => {
  try {
    const targetUserId = req.params.id;
    const schema = z.object({
      name: z.string().min(1),
      role: z.enum(['MANAGER', 'WAITER', 'KITCHEN', 'CASHIER']),
      isActive: z.boolean(),
      password: z.string().optional()
    });
    const parsed = schema.parse(req.body);
    
    const targetUser = await db.select().from(users).where(and(eq(users.id, targetUserId), eq(users.restaurantId, req.user.restaurantId))).get();
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    
    if (req.user.role === 'MANAGER') {
      if (targetUser.role === 'OWNER') return res.status(403).json({ error: 'Cannot modify owner' });
      if (targetUser.role === 'MANAGER' && req.user.id !== targetUser.id) return res.status(403).json({ error: 'Managers cannot modify other managers' });
      if (parsed.role === 'MANAGER' && targetUser.role !== 'MANAGER') return res.status(403).json({ error: 'Managers cannot promote to manager' });
    }
    
    const updates: any = {
      name: parsed.name,
      role: parsed.role,
      isActive: parsed.isActive,
      updatedAt: new Date()
    };
    
    if (parsed.password) {
      updates.passwordHash = await bcrypt.hash(parsed.password, 10);
    }
    
    if (!parsed.isActive && targetUser.isActive) {
      updates.disabledAt = new Date();
      updates.disabledByUserId = req.user.id;
    }

    if (!parsed.isActive) {
      await db.update(sessions).set({ revokedAt: new Date(), revokedReason: 'User deactivated' }).where(and(eq(sessions.userId, targetUserId), sql`revoked_at IS NULL`));
      req.app.get('disconnectUserSockets')?.(targetUserId);
    }
    
    await db.update(users).set(updates).where(eq(users.id, targetUserId));
    
    await db.insert(auditEvents).values({
      id: uuidv4(),
      restaurantId: req.user.restaurantId,
      actorUserId: req.user.id,
      action: 'STAFF_UPDATED',
      entityType: 'USER',
      entityId: targetUserId,
      createdAt: new Date(),
    });
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// TABLES MANAGEMENT
adminRouter.get('/tables', async (req: any, res) => {
  try {
    const allTables = await db.select().from(tables).orderBy(asc(tables.displayOrder), asc(tables.number));
    res.json(allTables);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.post('/tables', async (req: any, res) => {
  try {
    const schema = z.object({
      number: z.number().int().min(1),
      label: z.string().optional(),
      section: z.string().optional(),
      displayOrder: z.number().int().optional()
    });
    const parsed = schema.parse(req.body);
    
    const existing = await db.select().from(tables).where(and(
      eq(tables.number, parsed.number),
      isNull(tables.archivedAt)
    )).get();
    
    if (existing) {
      return res.status(400).json({ error: 'An active table with this number already exists' });
    }
    
    const id = uuidv4();
    const now = new Date();
    await db.insert(tables).values({
      id,
      number: parsed.number,
      label: parsed.label || null,
      section: parsed.section || 'Main Dining',
      displayOrder: parsed.displayOrder || parsed.number,
      status: 'EMPTY',
      createdAt: now,
      updatedAt: now,
    });
    
    await db.insert(auditEvents).values({
      id: uuidv4(),
      restaurantId: req.user.restaurantId,
      actorUserId: req.user.id,
      action: 'TABLE_CREATED',
      entityType: 'TABLE',
      entityId: id,
      metadata: JSON.stringify({ number: parsed.number, section: parsed.section, label: parsed.label }),
      createdAt: now,
    });
    
    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.post('/tables/batch', async (req: any, res) => {
  try {
    const schema = z.object({
      section: z.string().min(1),
      tableNumbers: z.array(z.number().int().min(1)).min(1),
      labelPrefix: z.string().optional()
    });
    const parsed = schema.parse(req.body);

    const existingTables = await db.select({ number: tables.number }).from(tables).where(isNull(tables.archivedAt));
    const existingSet = new Set(existingTables.map((t: any) => t.number));

    const duplicates = parsed.tableNumbers.filter((n: number) => existingSet.has(n));
    if (duplicates.length > 0) {
      return res.status(400).json({ error: `Table number(s) already exist: ${duplicates.join(', ')}` });
    }

    const now = new Date();
    await db.transaction(async (tx: any) => {
      for (const num of parsed.tableNumbers) {
        const id = uuidv4();
        await tx.insert(tables).values({
          id,
          number: num,
          label: parsed.labelPrefix ? `${parsed.labelPrefix} ${num}` : `Table ${num}`,
          section: parsed.section,
          displayOrder: num,
          status: 'EMPTY',
          createdAt: now,
          updatedAt: now,
        });
        await tx.insert(auditEvents).values({
          id: uuidv4(),
          restaurantId: req.user.restaurantId,
          actorUserId: req.user.id,
          action: 'TABLE_CREATED',
          entityType: 'TABLE',
          entityId: id,
          metadata: JSON.stringify({ number: num, section: parsed.section }),
          createdAt: now,
        });
      }
    });

    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true, count: parsed.tableNumbers.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.put('/tables/:id', async (req: any, res) => {
  try {
    const schema = z.object({
      number: z.number().int().min(1).optional(),
      label: z.string().nullable().optional(),
      section: z.string().optional(),
      displayOrder: z.number().int().optional(),
      archived: z.boolean().optional()
    });
    const parsed = schema.parse(req.body);
    const targetId = req.params.id;

    const currentTable = await db.select().from(tables).where(eq(tables.id, targetId)).get();
    if (!currentTable) return res.status(404).json({ error: 'Table not found' });

    if (parsed.archived && currentTable.status === 'ACTIVE') {
      return res.status(400).json({ error: 'Cannot archive a table with an active open order' });
    }
    
    // check duplicate number if updating number or un-archiving
    if (parsed.number && (parsed.number !== currentTable.number || parsed.archived === false)) {
      const existing = await db.select().from(tables).where(and(
        eq(tables.number, parsed.number),
        not(eq(tables.id, targetId)),
        isNull(tables.archivedAt)
      )).get();
      if (existing) return res.status(400).json({ error: 'Another active table with this number already exists' });
    }

    const updates: any = { updatedAt: new Date() };
    if (parsed.number !== undefined) updates.number = parsed.number;
    if (parsed.label !== undefined) updates.label = parsed.label;
    if (parsed.section !== undefined) updates.section = parsed.section;
    if (parsed.displayOrder !== undefined) updates.displayOrder = parsed.displayOrder;
    if (parsed.archived !== undefined) updates.archivedAt = parsed.archived ? new Date() : null;
    
    await db.update(tables).set(updates).where(eq(tables.id, targetId));
    
    await db.insert(auditEvents).values({
      id: uuidv4(),
      restaurantId: req.user.restaurantId,
      actorUserId: req.user.id,
      action: parsed.archived ? 'TABLE_ARCHIVED' : (parsed.archived === false ? 'TABLE_RESTORED' : 'TABLE_UPDATED'),
      entityType: 'TABLE',
      entityId: targetId,
      metadata: JSON.stringify(updates),
      createdAt: new Date(),
    });
    
    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.post('/tables/reorder', async (req: any, res) => {
  try {
    const schema = z.object({
      orderings: z.array(z.object({
        id: z.string(),
        displayOrder: z.number().int()
      }))
    });
    const { orderings } = schema.parse(req.body);
    const now = new Date();

    await db.transaction(async (tx) => {
      for (const item of orderings) {
        await tx.update(tables).set({ displayOrder: item.displayOrder, updatedAt: now }).where(eq(tables.id, item.id));
      }
    });

    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.delete('/tables/:id', async (req: any, res) => {
  try {
    const targetId = req.params.id;
    const currentTable = await db.select().from(tables).where(eq(tables.id, targetId)).get();
    if (!currentTable) return res.status(404).json({ error: 'Table not found' });

    if (currentTable.status === 'ACTIVE') {
      return res.status(400).json({ error: 'Cannot delete table while active order is in progress' });
    }

    // Check if table has historical orders
    const pastOrders = await db.select({ id: orders.id }).from(orders).where(eq(orders.tableId, targetId)).limit(1);

    if (pastOrders.length > 0) {
      // Soft-archive to preserve foreign-key relational integrity
      await db.update(tables).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(tables.id, targetId));
      await db.insert(auditEvents).values({
        id: uuidv4(),
        restaurantId: req.user.restaurantId,
        actorUserId: req.user.id,
        action: 'TABLE_ARCHIVED',
        entityType: 'TABLE',
        entityId: targetId,
        metadata: JSON.stringify({ reason: 'archived_due_to_order_history' }),
        createdAt: new Date(),
      });
    } else {
      // Safe to hard delete
      await db.delete(tables).where(eq(tables.id, targetId));
      await db.insert(auditEvents).values({
        id: uuidv4(),
        restaurantId: req.user.restaurantId,
        actorUserId: req.user.id,
        action: 'TABLE_DELETED',
        entityType: 'TABLE',
        entityId: targetId,
        createdAt: new Date(),
      });
    }

    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});


// --- PAIRING (QR) ---
adminRouter.post('/pairing/generate', async (req: any, res) => {
  try {
    const schema = z.object({
      userId: z.string().min(1)
    });
    const parsed = schema.parse(req.body);
    
    const targetUser = await db.select().from(users).where(and(eq(users.id, parsed.userId), eq(users.restaurantId, req.user.restaurantId))).get();
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (!targetUser.isActive) return res.status(400).json({ error: 'User is deactivated' });
    
    // Generate a secure short-lived token
    const rawToken = crypto.randomBytes(24).toString('base64url');
    const tokenHash = hashToken(rawToken);
    const id = uuidv4();
    const now = new Date();
    
    await db.insert(pairingTokens).values({
      id,
      restaurantId: req.user.restaurantId,
      userId: targetUser.id,
      tokenHash,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 15 * 60 * 1000), // 15 mins expiry
    });
    
    await db.insert(auditEvents).values({
      id: uuidv4(),
      restaurantId: req.user.restaurantId,
      actorUserId: req.user.id,
      action: 'PAIRING_CREATED',
      entityType: 'USER',
      entityId: targetUser.id,
      createdAt: now,
    });
    
    res.json({ token: rawToken });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.post('/pairing/invalidate', async (req: any, res) => {
  try {
    const schema = z.object({
      userId: z.string().min(1)
    });
    const parsed = schema.parse(req.body);
    
    // Invalidate all pending tokens for user
    await db.update(pairingTokens)
      .set({ invalidatedAt: new Date() })
      .where(and(
        eq(pairingTokens.userId, parsed.userId),
        eq(pairingTokens.restaurantId, req.user.restaurantId),
        sql`used_at IS NULL AND invalidated_at IS NULL AND expires_at > ${Math.floor(new Date().getTime() / 1000)}`
      ));
      
    await db.insert(auditEvents).values({
      id: uuidv4(),
      restaurantId: req.user.restaurantId,
      actorUserId: req.user.id,
      action: 'PAIRING_INVALIDATED',
      entityType: 'USER',
      entityId: parsed.userId,
      createdAt: new Date(),
    });
      
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- DEVICES MANAGEMENT ---
adminRouter.get('/devices', async (req: any, res) => {
  try {
    const allDevices = await db.select({
      id: devices.id,
      deviceIdentifier: devices.deviceIdentifier,
      name: devices.name,
      type: devices.type,
      createdAt: devices.createdAt,
      lastSeenAt: devices.lastSeenAt,
      revokedAt: devices.revokedAt,
      userName: users.name,
    })
    .from(devices)
    .leftJoin(sessions, eq(sessions.deviceId, devices.id))
    .leftJoin(users, eq(sessions.userId, users.id))
    .where(eq(devices.restaurantId, req.user.restaurantId));
    
    // De-duplicate by device ID (a device might have multiple sessions)
    const uniqueDevicesMap = new Map();
    for (const d of allDevices) {
      if (!uniqueDevicesMap.has(d.id)) {
        uniqueDevicesMap.set(d.id, d);
      } else if (d.userName && !uniqueDevicesMap.get(d.id).userName) {
        uniqueDevicesMap.set(d.id, d); // Prefer the one with a username
      }
    }
    
    res.json(Array.from(uniqueDevicesMap.values()));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.post('/devices/:id/revoke', async (req: any, res) => {
  try {
    const targetId = req.params.id;
    const targetDevice = await db.select().from(devices).where(and(eq(devices.id, targetId), eq(devices.restaurantId, req.user.restaurantId))).get();
    if (!targetDevice) return res.status(404).json({ error: 'Device not found' });
    
    const now = new Date();
    
    await db.transaction(async (tx) => {
      // 1. Mark device revoked
      await tx.update(devices).set({ revokedAt: now, revokedByUserId: req.user.id }).where(eq(devices.id, targetId));
      
      // 2. Revoke all sessions for this device
      await tx.update(sessions).set({ revokedAt: now, revokedReason: 'Device revoked' })
        .where(and(eq(sessions.deviceId, targetId), sql`revoked_at IS NULL`));
        
      // 3. Audit log
      await tx.insert(auditEvents).values({
        id: uuidv4(),
        restaurantId: req.user.restaurantId,
        actorUserId: req.user.id,
        action: 'DEVICE_REVOKED',
        entityType: 'DEVICE',
        entityId: targetId,
        createdAt: now,
      });
    });
    
    req.app.get('disconnectDeviceSockets')?.(targetId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.get('/menu', async (req: any, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const categories = await (includeArchived 
      ? db.select().from(menuCategories).orderBy(asc(menuCategories.displayOrder))
      : db.select().from(menuCategories).where(isNull(menuCategories.archivedAt)).orderBy(asc(menuCategories.displayOrder))
    );
    
    const items = await (includeArchived
      ? db.select().from(menuItems).orderBy(asc(menuItems.displayOrder))
      : db.select().from(menuItems).where(isNull(menuItems.archivedAt)).orderBy(asc(menuItems.displayOrder))
    );
    
    res.json({ categories, items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.post('/menu/categories', async (req: any, res) => {
  try {
    const { name, displayOrder } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    const id = uuidv4();
    await db.insert(menuCategories).values({
      id,
      name,
      displayOrder: displayOrder || 0
    });
    
    await db.insert(auditEvents).values({
      id: uuidv4(),
      restaurantId: req.user.restaurantId,
      actorUserId: req.user.id,
      action: 'MENU_CATEGORY_CREATED',
      entityType: 'MENU_CATEGORY',
      entityId: id,
      metadata: JSON.stringify({ name }),
      createdAt: new Date(),
    });

    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.delete('/menu/categories/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const actionOnItems = req.query.actionOnItems || req.body?.actionOnItems || 'ARCHIVE_ITEMS';
    const targetCategoryId = req.query.targetCategoryId || req.body?.targetCategoryId;
    const now = new Date();

    await db.transaction(async (tx) => {
      // Find active and all items in this category
      const allCatItems = await tx.select().from(menuItems).where(eq(menuItems.categoryId, id));
      const activeCatItems = allCatItems.filter((i: any) => !i.archivedAt);

      if (allCatItems.length > 0) {
        if (actionOnItems === 'MOVE_ITEMS' && targetCategoryId) {
          // Reassign all items to the target category
          await tx.update(menuItems)
            .set({ categoryId: targetCategoryId, updatedAt: now })
            .where(eq(menuItems.categoryId, id));

          await tx.insert(auditEvents).values({
            id: uuidv4(),
            restaurantId: req.user.restaurantId,
            actorUserId: req.user.id,
            action: 'MENU_ITEMS_REASSIGNED',
            entityType: 'MENU_ITEM',
            entityId: targetCategoryId,
            metadata: JSON.stringify({ 
              sourceCategoryId: id, 
              targetCategoryId, 
              reassignedItemCount: allCatItems.length,
              itemIds: allCatItems.map((i: any) => i.id)
            }),
            createdAt: now,
          });
        } else {
          // Process deletion for each item in the category
          for (const item of allCatItems) {
            const orderRef = await tx.select({ count: sql`count(*)` }).from(orderItems).where(eq(orderItems.menuItemId, item.id)).get();
            if (!orderRef || Number(orderRef.count) === 0) {
              await tx.delete(menuItems).where(eq(menuItems.id, item.id));
            } else {
              await tx.update(menuItems)
                .set({ archivedAt: now, isAvailable: false, updatedAt: now })
                .where(eq(menuItems.id, item.id));
            }
          }

          await tx.insert(auditEvents).values({
            id: uuidv4(),
            restaurantId: req.user.restaurantId,
            actorUserId: req.user.id,
            action: 'MENU_ITEMS_BULK_DELETED',
            entityType: 'MENU_ITEM',
            entityId: id,
            metadata: JSON.stringify({ 
              categoryId: id, 
              itemCount: allCatItems.length,
              itemIds: allCatItems.map((i: any) => i.id)
            }),
            createdAt: now,
          });
        }
      }

      // Check if any items still reference this category
      const remainingItems = await tx.select().from(menuItems).where(eq(menuItems.categoryId, id));
      if (remainingItems.length === 0) {
        // Complete hard delete from menuCategories
        await tx.delete(menuCategories).where(eq(menuCategories.id, id));
      } else {
        // Soft delete category if historical references exist
        await tx.update(menuCategories).set({ archivedAt: now }).where(eq(menuCategories.id, id));
      }

      await tx.insert(auditEvents).values({
        id: uuidv4(),
        restaurantId: req.user.restaurantId,
        actorUserId: req.user.id,
        action: 'MENU_CATEGORY_DELETED',
        entityType: 'MENU_CATEGORY',
        entityId: id,
        metadata: JSON.stringify({ actionOnItems, targetCategoryId }),
        createdAt: now,
      });
    });

    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true, deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.put('/menu/categories/:id', async (req: any, res) => {
  try {
    const { name, displayOrder, archive, actionOnItems, targetCategoryId } = req.body;
    const { id } = req.params;
    const now = new Date();
    
    await db.transaction(async (tx) => {
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
      
      if (archive === true) {
        updateData.archivedAt = now;
        
        // Find active items in this category
        const activeCatItems = await tx.select().from(menuItems).where(
          and(eq(menuItems.categoryId, id), sql`archived_at IS NULL`)
        );

        if (activeCatItems.length > 0) {
          if (actionOnItems === 'MOVE_ITEMS' && targetCategoryId) {
            // Reassign active items to target category
            await tx.update(menuItems)
              .set({ categoryId: targetCategoryId, updatedAt: now })
              .where(and(eq(menuItems.categoryId, id), sql`archived_at IS NULL`));

            await tx.insert(auditEvents).values({
              id: uuidv4(),
              restaurantId: req.user.restaurantId,
              actorUserId: req.user.id,
              action: 'MENU_ITEMS_REASSIGNED',
              entityType: 'MENU_ITEM',
              entityId: targetCategoryId,
              metadata: JSON.stringify({ 
                sourceCategoryId: id, 
                targetCategoryId, 
                reassignedItemCount: activeCatItems.length,
                itemIds: activeCatItems.map(i => i.id)
              }),
              createdAt: now,
            });
          } else {
            // Bulk archive active items in this category
            await tx.update(menuItems)
              .set({ archivedAt: now, updatedAt: now })
              .where(and(eq(menuItems.categoryId, id), sql`archived_at IS NULL`));

            await tx.insert(auditEvents).values({
              id: uuidv4(),
              restaurantId: req.user.restaurantId,
              actorUserId: req.user.id,
              action: 'MENU_ITEMS_BULK_ARCHIVED',
              entityType: 'MENU_ITEM',
              entityId: id,
              metadata: JSON.stringify({ 
                categoryId: id, 
                archivedItemCount: activeCatItems.length,
                itemIds: activeCatItems.map(i => i.id)
              }),
              createdAt: now,
            });
          }
        }
      } else if (archive === false) {
        updateData.archivedAt = null;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.update(menuCategories).set(updateData).where(eq(menuCategories.id, id));
      }
      
      await tx.insert(auditEvents).values({
        id: uuidv4(),
        restaurantId: req.user.restaurantId,
        actorUserId: req.user.id,
        action: archive ? 'MENU_CATEGORY_ARCHIVED' : (archive === false ? 'MENU_CATEGORY_RESTORED' : 'MENU_CATEGORY_UPDATED'),
        entityType: 'MENU_CATEGORY',
        entityId: id,
        metadata: JSON.stringify({ updateData, actionOnItems, targetCategoryId }),
        createdAt: now,
      });
    });

    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.post('/menu/items', async (req: any, res) => {
  try {
    const { categoryId, name, description, price, isAvailable, displayOrder } = req.body;
    if (!categoryId || !name || price === undefined) return res.status(400).json({ error: 'Missing required fields' });
    
    const id = uuidv4();
    const now = new Date();
    await db.insert(menuItems).values({
      id,
      categoryId,
      name,
      description: description || null,
      price: Number(price),
      isAvailable: isAvailable !== false,
      displayOrder: displayOrder || 0,
      createdAt: now,
      updatedAt: now,
    });
    
    await db.insert(auditEvents).values({
      id: uuidv4(),
      restaurantId: req.user.restaurantId,
      actorUserId: req.user.id,
      action: 'MENU_ITEM_CREATED',
      entityType: 'MENU_ITEM',
      entityId: id,
      metadata: JSON.stringify({ name }),
      createdAt: now,
    });

    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.put('/menu/items/:id', async (req: any, res) => {
  try {
    const { categoryId, name, description, price, isAvailable, displayOrder, archive, restore } = req.body;
    const { id } = req.params;
    
    const updateData: any = { updatedAt: new Date() };
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = Number(price);
    if (isAvailable !== undefined) updateData.isAvailable = Boolean(isAvailable);
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    
    if (archive === true) updateData.archivedAt = new Date();
    if (restore === true) updateData.archivedAt = null;

    let action = 'MENU_ITEM_UPDATED';
    if (archive === true) action = 'MENU_ITEM_ARCHIVED';
    else if (restore === true) action = 'MENU_ITEM_RESTORED';
    else if (isAvailable !== undefined) action = 'MENU_ITEM_AVAILABILITY_CHANGED';

    await db.update(menuItems).set(updateData).where(eq(menuItems.id, id));
    
    await db.insert(auditEvents).values({
      id: uuidv4(),
      restaurantId: req.user.restaurantId,
      actorUserId: req.user.id,
      action,
      entityType: 'MENU_ITEM',
      entityId: id,
      metadata: JSON.stringify(updateData),
      createdAt: new Date(),
    });

    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.delete('/menu/items/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const now = new Date();

    const existingItem = await db.select().from(menuItems).where(eq(menuItems.id, id)).get();
    if (!existingItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    // Check if this item is referenced in historical order receipts
    const orderRef = await db.select({ count: sql`count(*)` }).from(orderItems).where(eq(orderItems.menuItemId, id)).get();
    
    if (!orderRef || Number(orderRef.count) === 0) {
      // Completely hard-delete the item from database
      await db.delete(menuItems).where(eq(menuItems.id, id));
    } else {
      // Historical orders reference this item - archive & deactivate
      await db.update(menuItems).set({ archivedAt: now, isAvailable: false, updatedAt: now }).where(eq(menuItems.id, id));
    }

    await db.insert(auditEvents).values({
      id: uuidv4(),
      restaurantId: req.user.restaurantId,
      actorUserId: req.user.id,
      action: 'MENU_ITEM_DELETED',
      entityType: 'MENU_ITEM',
      entityId: id,
      metadata: JSON.stringify({ id, name: existingItem.name }),
      createdAt: now,
    });

    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true, deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.post('/menu/import', async (req: any, res) => {
  try {
    const { mode, rows } = req.body; // mode: 'REPLACE' or 'MERGE'
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No valid rows provided' });
    }
    
    const now = new Date();

    await db.transaction(async (tx: any) => {
      if (mode === 'REPLACE') {
        // Soft delete all existing active menu items and categories
        await tx.update(menuCategories).set({ archivedAt: now }).where(not(sql`archived_at IS NOT NULL`));
        await tx.update(menuItems).set({ archivedAt: now, updatedAt: now }).where(not(sql`archived_at IS NOT NULL`));
      }

      // We need to resolve categories by name to category IDs
      const categoryCache = new Map<string, string>(); // name (lowercase) -> id
      
      const existingCategories = await tx.select().from(menuCategories).where(not(sql`archived_at IS NOT NULL`));
      for (const cat of existingCategories) {
        categoryCache.set(cat.name.trim().toLowerCase(), cat.id);
      }

      // Group items by category from the CSV
      const newItems = [];
      let importedCats = 0;
      let importedItems = 0;

      for (const row of rows) {
        const catName = row.category.trim();
        let catId = categoryCache.get(catName.toLowerCase());
        
        if (!catId) {
          catId = uuidv4();
          await tx.insert(menuCategories).values({
            id: catId,
            name: catName,
            displayOrder: parseInt(row.displayOrder) || importedCats
          });
          categoryCache.set(catName.toLowerCase(), catId);
          importedCats++;
        }
        
        const itemName = row.name.trim();
        
        if (mode === 'MERGE') {
          // Check for duplicate
          const existing = await tx.select().from(menuItems).where(and(eq(menuItems.categoryId, catId), eq(menuItems.name, itemName), not(sql`archived_at IS NOT NULL`)));
          if (existing.length > 0) {
            // Update existing or skip? Requirement: update them or skip. Let's update.
            await tx.update(menuItems).set({
              price: Number(row.price),
              description: row.description || null,
              isAvailable: row.isAvailable,
              displayOrder: parseInt(row.displayOrder) || 0,
              updatedAt: now
            }).where(eq(menuItems.id, existing[0].id));
            importedItems++;
            continue;
          }
        }
        
        // Insert new item
        await tx.insert(menuItems).values({
          id: uuidv4(),
          categoryId: catId,
          name: itemName,
          description: row.description || null,
          price: Number(row.price),
          isAvailable: row.isAvailable,
          displayOrder: parseInt(row.displayOrder) || importedItems,
          createdAt: now,
          updatedAt: now
        });
        importedItems++;
      }

      await tx.insert(auditEvents).values({
        id: uuidv4(),
        restaurantId: req.user.restaurantId,
        actorUserId: req.user.id,
        action: 'MENU_IMPORTED',
        entityType: 'RESTAURANT',
        entityId: req.user.restaurantId,
        metadata: JSON.stringify({ mode, importedCats, importedItems }),
        createdAt: now,
      });
    });

    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.get('/menu/export', async (req: any, res) => {
  try {
    const categories = await db.select().from(menuCategories).where(isNull(menuCategories.archivedAt)).orderBy(asc(menuCategories.displayOrder));
    const items = await db.select().from(menuItems).where(isNull(menuItems.archivedAt)).orderBy(asc(menuItems.displayOrder));
    
    const catMap = new Map(categories.map(c => [c.id, c.name]));
    
    // Header
    let csv = 'Category,Item Name,Price,Description,Available,Display Order\r\n';
    
    for (const item of items) {
      const catName = catMap.get(item.categoryId) || 'Uncategorized';
      const escape = (val: any) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };
      
      csv += `${escape(catName)},${escape(item.name)},${item.price.toFixed(2)},${escape(item.description || '')},${item.isAvailable ? 'YES' : 'NO'},${item.displayOrder || 0}\r\n`;
    }
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="menu_export_${new Date().toISOString().split('T')[0]}.csv"`);
    res.status(200).send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.get(['/menu/csv/template', '/menu/template'], (req: any, res) => {
  const templateCsv = 'Category,Item Name,Price,Description,Available,Display Order\r\nStarters,Garlic Bread,6.50,Crispy baked bread with garlic herb butter,YES,1\r\nMains,Margherita Pizza,14.00,San Marzano tomatoes, fresh mozzarella, basil,YES,2\r\nDesserts,Tiramisu,8.00,Classic Italian espresso-soaked savoiardi with mascarpone,YES,3\r\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="restaurantos_menu_template.csv"');
  res.status(200).send(templateCsv);
});

adminRouter.post('/menu/categories/reorder', async (req: any, res) => {
  try {
    const schema = z.object({
      orderings: z.array(z.object({
        id: z.string(),
        displayOrder: z.number().int()
      }))
    });
    const { orderings } = schema.parse(req.body);
    
    await db.transaction(async (tx) => {
      for (const item of orderings) {
        await tx.update(menuCategories).set({ displayOrder: item.displayOrder }).where(eq(menuCategories.id, item.id));
      }
    });

    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.post('/menu/items/reorder', async (req: any, res) => {
  try {
    const schema = z.object({
      orderings: z.array(z.object({
        id: z.string(),
        displayOrder: z.number().int()
      }))
    });
    const { orderings } = schema.parse(req.body);
    
    await db.transaction(async (tx) => {
      for (const item of orderings) {
        await tx.update(menuItems).set({ displayOrder: item.displayOrder, updatedAt: new Date() }).where(eq(menuItems.id, item.id));
      }
    });

    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

adminRouter.get('/menu/archived', async (req: any, res) => {
  try {
    const categories = await db.select().from(menuCategories).where(sql`archived_at IS NOT NULL`);
    const items = await db.select().from(menuItems).where(sql`archived_at IS NOT NULL`);
    res.json({ categories, items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.get('/menu', async (req: any, res) => {
  try {
    const categories = await db.select().from(menuCategories).where(isNull(menuCategories.archivedAt)).orderBy(asc(menuCategories.displayOrder));
    const items = await db.select().from(menuItems).where(isNull(menuItems.archivedAt)).orderBy(asc(menuItems.displayOrder));
    
    res.json({ categories, items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// GROUP 3 — ORDER HISTORY (Operational Records)
// ==========================================
adminRouter.get('/orders/history', async (req: any, res) => {
  try {
    const { tableId, status, startDate, endDate, staffUserId, search, limit = 50, offset = 0 } = req.query;

    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const userMap = new Map(allUsers.map((u: any) => [u.id, u.name]));

    const allTables = await db.select({ id: tables.id, number: tables.number, label: tables.label }).from(tables);
    const tableMap = new Map(allTables.map((t: any) => [t.id, t]));

    // Query orders
    let query = db.select().from(orders);
    const conditions: any[] = [];

    if (tableId) {
      conditions.push(eq(orders.tableId, String(tableId)));
    }
    if (status && status !== 'ALL') {
      conditions.push(eq(orders.status, String(status)));
    }
    if (startDate) {
      const start = new Date(String(startDate));
      if (!isNaN(start.getTime())) {
        conditions.push(gte(orders.createdAt, start));
      }
    }
    if (endDate) {
      const end = new Date(String(endDate));
      if (!isNaN(end.getTime())) {
        conditions.push(lte(orders.createdAt, end));
      }
    }
    if (staffUserId) {
      conditions.push(sql`(${orders.openedByUserId} = ${staffUserId} OR ${orders.closedByUserId} = ${staffUserId})`);
    }

    const orderList = await db.select().from(orders)
      .where(conditions.length > 0 ? and(...conditions) : sql`1=1`)
      .orderBy(desc(orders.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    const orderIds = orderList.map((o: any) => o.id);
    let itemsByOrder: any[] = [];
    if (orderIds.length > 0) {
      itemsByOrder = await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds));
    }

    const enrichedOrders = orderList.map((o: any) => {
      const t = tableMap.get(o.tableId);
      const items = itemsByOrder.filter((i: any) => i.orderId === o.id).map((i: any) => ({
        id: i.id,
        orderId: i.orderId,
        menuItemId: i.menuItemId,
        name: i.productNameSnapshot,
        price: i.unitPriceSnapshot,
        quantity: i.quantity,
        notes: i.notes,
        kitchenStatus: i.kitchenStatus,
        kitchenStatusUpdatedAt: i.kitchenStatusUpdatedAt,
        addedByUserId: i.addedByUserId,
        addedByName: i.addedByUserId ? userMap.get(i.addedByUserId) || 'Staff' : null,
        createdAt: i.createdAt
      }));

      const totalItems = items.reduce((sum: number, i: any) => sum + i.quantity, 0);
      const totalAmount = items.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);

      return {
        id: o.id,
        tableId: o.tableId,
        tableNumber: t?.number || '?',
        tableLabel: t?.label || null,
        status: o.status,
        openedByUserId: o.openedByUserId,
        openedByName: o.openedByUserId ? userMap.get(o.openedByUserId) || 'Staff' : null,
        closedByUserId: o.closedByUserId,
        closedByName: o.closedByUserId ? userMap.get(o.closedByUserId) || 'Staff' : null,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        totalItems,
        totalAmount,
        items
      };
    });

    // If search term provided, filter in memory by item name or note
    let result = enrichedOrders;
    if (search && String(search).trim()) {
      const term = String(search).trim().toLowerCase();
      result = result.filter(o => 
        String(o.tableNumber).includes(term) ||
        (o.openedByName && o.openedByName.toLowerCase().includes(term)) ||
        (o.closedByName && o.closedByName.toLowerCase().includes(term)) ||
        o.items.some((i: any) => i.name.toLowerCase().includes(term) || (i.notes && i.notes.toLowerCase().includes(term)))
      );
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.get('/orders/:id', async (req: any, res) => {
  try {
    const orderId = req.params.id;
    const order = await db.select().from(orders).where(eq(orders.id, orderId)).get();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const table = await db.select().from(tables).where(eq(tables.id, order.tableId)).get();

    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const userMap = new Map(allUsers.map((u: any) => [u.id, u.name]));

    const enrichedItems = items.map((i: any) => ({
      id: i.id,
      orderId: i.orderId,
      menuItemId: i.menuItemId,
      name: i.productNameSnapshot,
      price: i.unitPriceSnapshot,
      quantity: i.quantity,
      notes: i.notes,
      kitchenStatus: i.kitchenStatus,
      kitchenStatusUpdatedAt: i.kitchenStatusUpdatedAt,
      addedByUserId: i.addedByUserId,
      addedByName: i.addedByUserId ? userMap.get(i.addedByUserId) || 'Staff' : null,
      createdAt: i.createdAt
    }));

    res.json({
      ...order,
      tableNumber: table?.number,
      tableLabel: table?.label,
      openedByName: order.openedByUserId ? userMap.get(order.openedByUserId) || 'Staff' : null,
      closedByName: order.closedByUserId ? userMap.get(order.closedByUserId) || 'Staff' : null,
      items: enrichedItems,
      totalItems: enrichedItems.reduce((s: number, i: any) => s + i.quantity, 0),
      totalAmount: enrichedItems.reduce((s: number, i: any) => s + (i.price * i.quantity), 0)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// GROUP 4 — AUDIT LOG VIEWER
// ==========================================
adminRouter.get('/audit-logs', async (req: any, res) => {
  try {
    const { action, actorUserId, startDate, endDate, search, limit = 100, offset = 0 } = req.query;

    const allUsers = await db.select({ id: users.id, name: users.name, role: users.role }).from(users);
    const userMap = new Map(allUsers.map((u: any) => [u.id, u]));

    const allDevices = await db.select({ id: devices.id, name: devices.name }).from(devices);
    const deviceMap = new Map(allDevices.map((d: any) => [d.id, d.name]));

    const conditions: any[] = [eq(auditEvents.restaurantId, req.user.restaurantId)];

    if (action && action !== 'ALL') {
      conditions.push(eq(auditEvents.action, String(action)));
    }
    if (actorUserId && actorUserId !== 'ALL') {
      conditions.push(eq(auditEvents.actorUserId, String(actorUserId)));
    }
    if (startDate) {
      const start = new Date(String(startDate));
      if (!isNaN(start.getTime())) {
        conditions.push(gte(auditEvents.createdAt, start));
      }
    }
    if (endDate) {
      const end = new Date(String(endDate));
      if (!isNaN(end.getTime())) {
        conditions.push(lte(auditEvents.createdAt, end));
      }
    }

    const events = await db.select().from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    const enrichedEvents = events.map((e: any) => {
      const actor = e.actorUserId ? userMap.get(e.actorUserId) : null;
      let parsedMetadata = null;
      if (e.metadata) {
        try {
          parsedMetadata = JSON.parse(e.metadata);
        } catch {
          parsedMetadata = e.metadata;
        }
      }

      return {
        id: e.id,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        actorUserId: e.actorUserId,
        actorName: actor?.name || 'System / Unassigned',
        actorRole: actor?.role || null,
        actorDeviceId: e.actorDeviceId,
        actorDeviceName: e.actorDeviceId ? deviceMap.get(e.actorDeviceId) || 'Unknown Device' : null,
        metadata: parsedMetadata,
        createdAt: e.createdAt
      };
    });

    let result = enrichedEvents;
    if (search && String(search).trim()) {
      const term = String(search).trim().toLowerCase();
      result = result.filter(e => 
        e.action.toLowerCase().includes(term) ||
        (e.entityType && e.entityType.toLowerCase().includes(term)) ||
        (e.entityId && e.entityId.toLowerCase().includes(term)) ||
        (e.actorName && e.actorName.toLowerCase().includes(term)) ||
        (e.metadata && JSON.stringify(e.metadata).toLowerCase().includes(term))
      );
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// GROUP 7 — BACKUP & RESTORE FOUNDATION
// ==========================================

function ensureBackupDir() {
  ensureDirectories();
}

async function performSafeBackup(type: 'manual' | 'auto' | 'pre-restore', restaurantId: string, actorUserId: string) {
  ensureBackupDir();
  
  // Safe checkpoint to make sure WAL changes are flushed
  try {
    await db.run(sql.raw('PRAGMA wal_checkpoint(TRUNCATE);'));
    await db.run(sql.raw('PRAGMA integrity_check;'));
  } catch (e) {
    console.warn('wal_checkpoint error ignored:', e);
  }

  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${type}_${timestampStr}.db`;
  const targetPath = path.join(BACKUP_DIR, filename);

  // Safely copy the DB file
  fs.copyFileSync(DB_PATH, targetPath);
  const stats = fs.statSync(targetPath);

  if (stats.size === 0) {
    fs.unlinkSync(targetPath);
    throw new Error('Database backup file creation resulted in 0-byte corrupt file');
  }

  // Rotation: Keep top 15 most recent backups
  try {
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db'));
    if (files.length > 15) {
      const sorted = files.map(f => ({
        name: f,
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs
      })).sort((a, b) => b.time - a.time);

      for (let i = 15; i < sorted.length; i++) {
        try {
          fs.unlinkSync(path.join(BACKUP_DIR, sorted[i].name));
        } catch {}
      }
    }
  } catch (e) {
    console.warn('Backup rotation error ignored:', e);
  }

  // Audit event
  await db.insert(auditEvents).values({
    id: uuidv4(),
    restaurantId,
    actorUserId,
    action: 'BACKUP_CREATED',
    entityType: 'RESTAURANT',
    entityId: restaurantId,
    metadata: JSON.stringify({ type, filename, sizeBytes: stats.size }),
    createdAt: new Date(),
  });

  return { filename, sizeBytes: stats.size, createdAt: new Date() };
}

adminRouter.get('/backups', async (req: any, res) => {
  try {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db'));
    const backups = files.map(f => {
      const fullPath = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(fullPath);
      let type: 'manual' | 'auto' | 'pre-restore' | 'other' = 'other';
      if (f.startsWith('backup_manual_')) type = 'manual';
      else if (f.startsWith('backup_auto_')) type = 'auto';
      else if (f.startsWith('backup_pre-restore_') || f.startsWith('backup_pre_restore_')) type = 'pre-restore';

      return {
        filename: f,
        sizeBytes: stat.size,
        createdAt: stat.mtime,
        type
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(backups);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.post('/backups/create', async (req: any, res) => {
  try {
    const backup = await performSafeBackup('manual', req.user.restaurantId, req.user.id);
    res.json({ success: true, backup });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.get('/backups/download/:filename', async (req: any, res) => {
  try {
    const filename = req.params.filename;
    // Sanitization against path traversal
    const safeFilename = path.basename(filename);
    const fullPath = path.join(BACKUP_DIR, safeFilename);

    if (!fs.existsSync(fullPath) || !safeFilename.endsWith('.db')) {
      return res.status(404).json({ error: 'Backup file not found' });
    }

    res.download(fullPath, safeFilename);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.post('/backups/restore', async (req: any, res) => {
  try {
    if (req.user.role !== 'OWNER' && req.user.role !== 'MANAGER') {
      return res.status(403).json({ error: 'Only owners or managers can restore backups' });
    }

    const { filename, confirm } = req.body;
    if (!confirm || !filename) {
      return res.status(400).json({ error: 'Explicit confirmation and filename are required' });
    }

    const safeFilename = path.basename(filename);
    const sourceBackupPath = path.join(BACKUP_DIR, safeFilename);
    if (!fs.existsSync(sourceBackupPath) || !safeFilename.endsWith('.db')) {
      return res.status(404).json({ error: 'Selected backup file does not exist' });
    }

    // 1. Take a safety pre-restore backup first
    await performSafeBackup('pre-restore', req.user.restaurantId, req.user.id);

    // 2. Perform safe restore
    try {
      await db.run(sql.raw('PRAGMA wal_checkpoint(PASSIVE);'));
    } catch {}

    fs.copyFileSync(sourceBackupPath, DB_PATH);

    // Remove any stale WAL / SHM files if present
    try {
      if (fs.existsSync(`${DB_PATH}-wal`)) fs.unlinkSync(`${DB_PATH}-wal`);
      if (fs.existsSync(`${DB_PATH}-shm`)) fs.unlinkSync(`${DB_PATH}-shm`);
    } catch {}

    // Verify integrity
    await db.run(sql.raw('PRAGMA integrity_check;'));

    // Audit log
    await db.insert(auditEvents).values({
      id: uuidv4(),
      restaurantId: req.user.restaurantId,
      actorUserId: req.user.id,
      action: 'DATABASE_RESTORED',
      entityType: 'RESTAURANT',
      entityId: req.user.restaurantId,
      metadata: JSON.stringify({ restoredFrom: safeFilename }),
      createdAt: new Date(),
    });

    await emitStateUpdate(req.app.get('io'), req.user.restaurantId);
    res.json({ success: true, message: 'Database successfully restored' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// GROUP 8 — SYSTEM HEALTH / LOCAL HUB
// ==========================================
adminRouter.get('/system/health', async (req: any, res) => {
  try {
    ensureBackupDir();
    const backupFiles = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db'));
    let lastBackupTime: Date | null = null;
    if (backupFiles.length > 0) {
      const times = backupFiles.map(f => fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs);
      lastBackupTime = new Date(Math.max(...times));
    }

    let dbSizeBytes = 0;
    if (fs.existsSync(DB_PATH)) {
      dbSizeBytes = fs.statSync(DB_PATH).size;
    }

    // Fetch counts from key tables
    const tableCountRes = await db.select({ count: sql`COUNT(*)` }).from(tables);
    const orderCountRes = await db.select({ count: sql`COUNT(*)` }).from(orders);
    const orderItemCountRes = await db.select({ count: sql`COUNT(*)` }).from(orderItems);
    const menuItemCountRes = await db.select({ count: sql`COUNT(*)` }).from(menuItems).where(isNull(menuItems.archivedAt));
    const userCountRes = await db.select({ count: sql`COUNT(*)` }).from(users);
    const deviceCountRes = await db.select({ count: sql`COUNT(*)` }).from(devices);
    const auditCountRes = await db.select({ count: sql`COUNT(*)` }).from(auditEvents);

    const hubStateRes = await db.select().from(hubState).where(eq(hubState.restaurantId, req.user.restaurantId)).get();

    const io = req.app.get('io');
    const connectedSockets = io ? io.sockets?.sockets?.size || 0 : 0;

    const lanIps = req.app.get('lanIps') || [];

    res.json({
      hubStatus: 'HEALTHY',
      appVersion: '1.0.0',
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      lanIps,
      db: {
        status: 'ONLINE',
        mode: 'WAL',
        sizeBytes: dbSizeBytes,
        tablesCount: Number(tableCountRes[0]?.count || 0),
        ordersCount: Number(orderCountRes[0]?.count || 0),
        orderItemsCount: Number(orderItemCountRes[0]?.count || 0),
        menuItemsCount: Number(menuItemCountRes[0]?.count || 0),
        usersCount: Number(userCountRes[0]?.count || 0),
        devicesCount: Number(deviceCountRes[0]?.count || 0),
        auditEventsCount: Number(auditCountRes[0]?.count || 0),
      },
      memory: {
        rssBytes: process.memoryUsage().rss,
        heapUsedBytes: process.memoryUsage().heapUsed,
        heapTotalBytes: process.memoryUsage().heapTotal
      },
      hubStateVersion: hubStateRes?.version || 1,
      connectedClientsCount: connectedSockets,
      backupSummary: {
        totalBackups: backupFiles.length,
        lastBackupAt: lastBackupTime,
        status: 'OK'
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export function startAutoBackupScheduler() {
  // Daily auto backup scheduler (every 24 hours), with first run check 30s after startup
  const intervalMs = 24 * 60 * 60 * 1000;
  
  const runAutoBackup = async () => {
    try {
      const allRest = await db.select({ id: restaurants.id }).from(restaurants).limit(1);
      const restaurantId = allRest[0]?.id;
      if (!restaurantId) return;

      const allAdmins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'OWNER')).limit(1);
      const actorId = allAdmins[0]?.id || 'system_auto';

      await performSafeBackup('auto', restaurantId, actorId);
      console.log(`[AutoBackup] Successfully created automatic backup at ${new Date().toISOString()}`);
    } catch (e) {
      console.warn('[AutoBackup] Auto-backup check:', e);
    }
  };

  setTimeout(runAutoBackup, 30000);
  setInterval(runAutoBackup, intervalMs);
}

