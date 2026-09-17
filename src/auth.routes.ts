import { Router } from 'express';
import { db } from './db/index';
import { 
  restaurants, 
  users, 
  sessions, 
  devices, 
  auditEvents, 
  pairingTokens, 
  tables, 
  menuCategories, 
  menuItems,
  orders,
  orderItems,
  idempotencyKeys,
  hubState,
  installations,
  licenses
} from './db/schema';
import { eq, and, sql, gt } from 'drizzle-orm';
import { hashPassword, verifyPassword, generateToken, hashToken } from './crypto';
import { SetupPayloadSchema, LoginPayloadSchema } from './schemas';
import { uuidv4 } from './utils/uuid';
import { z } from 'zod';
import { logger } from './logger';
import { authenticate } from './auth.middleware';
import { LicensingService } from './licensing/service';

export const authRouter = Router();

// In-memory rate limiting logic
const loginAttempts = new Map<string, { count: number, resetAt: number }>();
const pairAttempts = new Map<string, { count: number, resetAt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

// Auth Status check - returns configured / unconfigured state
authRouter.get(['/status', '/setup-status'], async (req, res) => {
  try {
    const rs = await db.select().from(restaurants).limit(1);
    const configured = rs.length > 0;
    res.json({
      configured,
      isInitialized: configured,
      status: configured ? 'CONFIGURED' : 'UNCONFIGURED',
      restaurantName: configured ? rs[0].name : null,
      language: configured ? (rs[0].language || 'en') : 'en',
      currency: configured ? rs[0].currency : null,
      timezone: configured ? rs[0].timezone : null,
    });
  } catch (err: any) {
    logger.error('Failed to get auth status', { error: err.message });
    res.status(500).json({
      error: err.message,
      configured: false,
      isInitialized: false,
      status: 'UNCONFIGURED'
    });
  }
});

// DEVELOPMENT ONLY: Reset database to unconfigured state
authRouter.post('/dev-reset-database', async (req: any, res: any) => {
  // STRICT GUARD: Must only be accessible in development environments
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Database reset endpoint is strictly forbidden in production mode.' });
  }

  const { confirmation } = req.body || {};
  if (confirmation !== 'RESET_LOCAL_DEVELOPMENT_DATABASE') {
    return res.status(400).json({ 
      error: 'Explicit confirmation required. Send { confirmation: "RESET_LOCAL_DEVELOPMENT_DATABASE" }' 
    });
  }

  try {
    logger.warn('[DEV ONLY] Resetting local development database to unconfigured state...');

    // Disconnect and invalidate all connected socket sessions
    const io = req.app?.get('io');
    if (io) {
      io.sockets.sockets.forEach((s: any) => {
        s.emit('AUTH_REVOKED', { reason: 'Development database reset to unconfigured state' });
        s.disconnect(true);
      });
    }

    // Reset rate-limit maps
    loginAttempts.clear();
    pairAttempts.clear();

    // Safely delete records in reverse foreign-key order
    await db.transaction(async (tx) => {
      await tx.delete(sessions);
      await tx.delete(pairingTokens);
      await tx.delete(idempotencyKeys);
      await tx.delete(auditEvents);
      await tx.delete(orderItems);
      await tx.delete(orders);
      await tx.delete(tables);
      await tx.delete(menuItems);
      await tx.delete(menuCategories);
      await tx.delete(devices);
      await tx.delete(users);
      await tx.delete(hubState);
      await tx.update(installations).set({ restaurantId: null });
      await tx.delete(licenses);
      await tx.delete(restaurants);
    });

    try {
      await db.run(sql.raw('PRAGMA wal_checkpoint(TRUNCATE);'));
      await db.run(sql.raw('VACUUM;'));
    } catch {}

    logger.info('[DEV ONLY] Local development database reset successfully. Hub is now UNCONFIGURED.');
    res.json({
      success: true,
      configured: false,
      isInitialized: false,
      status: 'UNCONFIGURED',
      message: 'Local development database successfully reset to unconfigured state.'
    });
  } catch (err: any) {
    logger.error('[DEV ONLY] Failed to reset development database', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

authRouter.post('/setup', async (req, res) => {
  try {
    const existing = await db.select().from(restaurants).limit(1);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Restaurant already initialized. Setup cannot be repeated.' });
    }

    // Require active valid license to complete first-run setup
    const licenseStatus = await LicensingService.getStatus();
    if (!licenseStatus.isLicensed || !licenseStatus.canOperate) {
      return res.status(402).json({ 
        error: 'A valid active license is required to complete RestaurantOS setup. Please activate your license key.',
        licenseStatus: licenseStatus.status 
      });
    }

    const payload = SetupPayloadSchema.parse(req.body);
    const restaurantId = uuidv4();
    const ownerId = uuidv4();
    const sessionId = uuidv4();
    const now = new Date();
    const sessionToken = generateToken();
    const tokenHash = hashToken(sessionToken);
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.transaction(async (tx) => {
      // 1. Create Restaurant
      await tx.insert(restaurants).values({
        id: restaurantId,
        name: payload.restaurantName.trim(),
        language: payload.language || 'en',
        currency: payload.currency.toUpperCase(),
        timezone: payload.timezone,
        seatingCapacity: payload.seatingCapacity || 30,
        logo: payload.logo || null,
        createdAt: now,
        updatedAt: now,
      });

      // 2. Link Installation and Licenses to the Restaurant
      const inst = await LicensingService.getOrCreateInstallation();
      await tx.update(installations)
        .set({ restaurantId })
        .where(eq(installations.id, inst.id));

      await tx.update(licenses)
        .set({ restaurantId })
        .where(eq(licenses.installationId, inst.id));

      // 3. Create Hub State tracking
      await tx.insert(hubState).values({
        restaurantId,
        version: 1,
        updatedAt: now,
      });

      // 3. Create Owner User
      await tx.insert(users).values({
        id: ownerId,
        restaurantId,
        name: payload.ownerName.trim(),
        username: payload.ownerUsername.trim(),
        passwordHash: hashPassword(payload.ownerPassword),
        role: 'OWNER',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      // 4. Create Initial Tables if requested or provided
      if (payload.initialTables && payload.initialTables.length > 0) {
        for (let i = 0; i < payload.initialTables.length; i++) {
          const t = payload.initialTables[i];
          await tx.insert(tables).values({
            id: uuidv4(),
            number: t.number,
            label: t.label || `Table ${t.number}`,
            section: t.section || 'Main Dining',
            displayOrder: i + 1,
            status: 'EMPTY',
            createdAt: now,
            updatedAt: now,
          });
        }
      } else if (payload.tableCount && payload.tableCount > 0) {
        const sectionsList = payload.sections && payload.sections.length > 0 ? payload.sections : ['Main Dining'];
        for (let i = 1; i <= payload.tableCount; i++) {
          const section = sectionsList[(i - 1) % sectionsList.length];
          await tx.insert(tables).values({
            id: uuidv4(),
            number: i,
            label: `Table ${i}`,
            section,
            displayOrder: i,
            status: 'EMPTY',
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      // 5. Create default categories for fresh start
      const defaultCategories = ['Starters', 'Mains', 'Desserts', 'Beverages'];
      for (let i = 0; i < defaultCategories.length; i++) {
        await tx.insert(menuCategories).values({
          id: uuidv4(),
          name: defaultCategories[i],
          displayOrder: i + 1,
        });
      }

      // 6. Create Initial Session for immediate seamless login
      await tx.insert(sessions).values({
        id: sessionId,
        userId: ownerId,
        tokenHash,
        createdAt: now,
        expiresAt,
        lastSeenAt: now,
      });

      // 7. Log Audit Event
      await tx.insert(auditEvents).values({
        id: uuidv4(),
        restaurantId,
        actorUserId: ownerId,
        action: 'RESTAURANT_INITIALIZED',
        entityType: 'RESTAURANT',
        entityId: restaurantId,
        metadata: JSON.stringify({
          name: payload.restaurantName,
          currency: payload.currency,
          timezone: payload.timezone,
          tablesCount: payload.tableCount || payload.initialTables?.length || 0,
        }),
        createdAt: now,
      });
    });

    logger.info('Restaurant initialized successfully', { restaurantId, ownerId });
    res.json({
      success: true,
      token: sessionToken,
      user: {
        id: ownerId,
        restaurantId,
        name: payload.ownerName,
        username: payload.ownerUsername,
        role: 'OWNER',
      },
      restaurant: {
        id: restaurantId,
        name: payload.restaurantName,
        language: payload.language || 'en',
        currency: payload.currency,
        timezone: payload.timezone,
        logo: payload.logo || null,
      }
    });
  } catch (err: any) {
    logger.error('Setup error', { error: err.message });
    res.status(400).json({ error: err.message || 'Invalid setup payload or internal error' });
  }
});


authRouter.post('/pair', async (req, res) => {
  try {
    const schema = z.object({
      token: z.string().min(1),
      deviceId: z.string().min(1)
    });
    const payload = schema.parse(req.body);
    
    const clientKey = `${req.ip || 'ip'}_${payload.deviceId}`;
    if (pairAttempts.has(clientKey)) {
      const attempt = pairAttempts.get(clientKey)!;
      if (Date.now() > attempt.resetAt) {
        pairAttempts.delete(clientKey);
      } else if (attempt.count >= MAX_ATTEMPTS) {
        return res.status(429).json({ error: 'Too many failed pairing attempts. Please wait 5 minutes.' });
      }
    }

    const tokenHash = hashToken(payload.token);
    const now = new Date();
    
    // Find the valid pairing token
    const tokenRecords = await db.select()
      .from(pairingTokens)
      .where(and(
        eq(pairingTokens.tokenHash, tokenHash),
        sql`used_at IS NULL`,
        sql`invalidated_at IS NULL`,
        gt(pairingTokens.expiresAt, now)
      ))
      .limit(1);
      
    if (tokenRecords.length === 0) {
      const current = pairAttempts.get(clientKey) || { count: 0, resetAt: Date.now() + LOCKOUT_MS };
      current.count += 1;
      pairAttempts.set(clientKey, current);
      return res.status(401).json({ error: 'Invalid or expired pairing code' });
    }
    
    // Reset pairing attempt on success
    pairAttempts.delete(clientKey);
    
    const pairingData = tokenRecords[0];
    const targetUserRecords = await db.select().from(users).where(eq(users.id, pairingData.userId)).limit(1);
    const user = targetUserRecords[0];
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User is inactive' });
    }

    const sessionToken = generateToken();
    const sessionTokenHash = hashToken(sessionToken);
    const sessionId = uuidv4();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await db.transaction(async (tx) => {
      // 1. Mark pairing token used
      await tx.update(pairingTokens).set({ usedAt: now }).where(eq(pairingTokens.id, pairingData.id));
      
      // 2. Manage device
      let deviceId = null;
      const deviceRecords = await tx.select().from(devices).where(eq(devices.deviceIdentifier, payload.deviceId)).limit(1);
      if (deviceRecords.length > 0) {
        deviceId = deviceRecords[0].id;
        
        // If device was revoked, reinstate it by un-revoking it?
        // Let's reinstate it (clear revokedAt) since they successfully paired again
        await tx.update(devices).set({ lastSeenAt: now, revokedAt: null, revokedByUserId: null }).where(eq(devices.id, deviceId));
      } else {
        deviceId = uuidv4();
        await tx.insert(devices).values({
          id: deviceId,
          restaurantId: user.restaurantId,
          deviceIdentifier: payload.deviceId,
          createdAt: now,
          lastSeenAt: now,
        });
        await tx.insert(auditEvents).values({
          id: uuidv4(),
          restaurantId: user.restaurantId,
          actorUserId: user.id,
          actorDeviceId: deviceId,
          action: 'DEVICE_PAIRED',
          entityType: 'DEVICE',
          entityId: deviceId,
          createdAt: now,
        });
      }
      
      // 3. Create session
      await tx.insert(sessions).values({
        id: sessionId,
        userId: user.id,
        deviceId: deviceId,
        tokenHash: sessionTokenHash,
        createdAt: now,
        expiresAt,
        lastSeenAt: now,
      });
      
      // 4. Update last login
      await tx.update(users).set({ lastLoginAt: now }).where(eq(users.id, user.id));
      
      // 5. Audit
      await tx.insert(auditEvents).values({
        id: uuidv4(),
        restaurantId: user.restaurantId,
        actorUserId: user.id,
        actorDeviceId: deviceId,
        action: 'PAIRING_USED',
        entityType: 'DEVICE',
        entityId: deviceId,
        metadata: JSON.stringify({ pairingTokenId: pairingData.id }),
        createdAt: now,
      });
    });

    res.json({ token: sessionToken, role: user.role });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});


authRouter.post('/login', async (req, res) => {
  try {
    const payload = LoginPayloadSchema.parse(req.body);
    
    if (loginAttempts.has(payload.username)) {
      const attempt = loginAttempts.get(payload.username)!;
      if (Date.now() > attempt.resetAt) {
        loginAttempts.delete(payload.username);
      } else if (attempt.count >= MAX_ATTEMPTS) {
        return res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
      }
    }

    const userRecords = await db.select().from(users).where(eq(users.username, payload.username)).limit(1);
    if (userRecords.length === 0 || !userRecords[0].isActive || userRecords[0].disabledAt) {
      // Record failed attempt to mask existence
      const attempt = loginAttempts.get(payload.username) || { count: 0, resetAt: Date.now() + LOCKOUT_MS };
      attempt.count++;
      loginAttempts.set(payload.username, attempt);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userRecords[0];
    const isValid = verifyPassword(payload.password, user.passwordHash);
    
    if (!isValid) {
      const attempt = loginAttempts.get(payload.username) || { count: 0, resetAt: Date.now() + LOCKOUT_MS };
      attempt.count++;
      loginAttempts.set(payload.username, attempt);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Success! Clear rate limit.
    loginAttempts.delete(payload.username);
    
    const now = new Date();
    const token = generateToken();
    const tokenHash = hashToken(token);
    const sessionId = uuidv4();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.transaction(async (tx) => {
      // Manage device identity foundation if passed (future-proofing)
      let deviceId = null;
      if (payload.deviceId) {
        const deviceRecords = await tx.select().from(devices).where(eq(devices.deviceIdentifier, payload.deviceId)).limit(1);
        if (deviceRecords.length > 0) {
          deviceId = deviceRecords[0].id;
          await tx.update(devices).set({ lastSeenAt: now }).where(eq(devices.id, deviceId));
        } else {
          deviceId = uuidv4();
          await tx.insert(devices).values({
            id: deviceId,
            restaurantId: user.restaurantId,
            deviceIdentifier: payload.deviceId,
            createdAt: now,
            lastSeenAt: now,
          });
        }
      }

      await tx.insert(sessions).values({
        id: sessionId,
        userId: user.id,
        deviceId,
        tokenHash,
        createdAt: now,
        expiresAt,
        lastSeenAt: now,
      });

      await tx.update(users).set({ lastLoginAt: now }).where(eq(users.id, user.id));

      await tx.insert(auditEvents).values({
        id: uuidv4(),
        restaurantId: user.restaurantId,
        actorUserId: user.id,
        actorDeviceId: deviceId,
        action: 'USER_LOGIN',
        createdAt: now,
      });
    });

    res.json({
      token,
      user: {
        id: user.id,
        restaurantId: user.restaurantId,
        name: user.name,
        username: user.username,
        role: user.role,
      }
    });

  } catch (err: any) {
    logger.error('Login error', { error: err.message });
    res.status(400).json({ error: 'Invalid payload' });
  }
});

authRouter.get('/me', authenticate, async (req, res) => {
  const user = (req as any).user;
  const rs = await db.select().from(restaurants).where(eq(restaurants.id, user.restaurantId)).limit(1);
  
  res.json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      restaurantId: user.restaurantId,
    },
    restaurant: rs.length > 0 ? {
      id: rs[0].id,
      name: rs[0].name,
      language: rs[0].language || 'en',
      currency: rs[0].currency,
      timezone: rs[0].timezone,
      logo: rs[0].logo || null,
    } : null
  });
});

authRouter.post('/logout', authenticate, async (req, res) => {
  const session = (req as any).session;
  const user = (req as any).user;
  const now = new Date();
  
  await db.transaction(async (tx) => {
    await tx.update(sessions)
      .set({ revokedAt: now, revokedReason: 'LOGOUT' })
      .where(eq(sessions.id, session.id));
      
    await tx.insert(auditEvents).values({
      id: uuidv4(),
      restaurantId: user.restaurantId,
      actorUserId: user.id,
      actorDeviceId: session.deviceId,
      action: 'USER_LOGOUT',
      createdAt: now,
    });
  });

  res.json({ success: true });
});
