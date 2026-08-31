const fs = require('fs');
let code = fs.readFileSync('src/api/admin.ts', 'utf8');

// add devices and pairingTokens imports
code = code.replace("hubState, sessions } from '../db/schema';", "hubState, sessions, devices, pairingTokens } from '../db/schema';");
code = code.replace("import { v4 as uuidv4 } from 'uuid';", "import { v4 as uuidv4 } from 'uuid';\nimport crypto from 'crypto';\nimport { hashToken } from '../crypto';");

const pairingEndpoints = `
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
        sql\`used_at IS NULL AND invalidated_at IS NULL AND expires_at > \${new Date().getTime()}\`
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
        .where(and(eq(sessions.deviceId, targetId), sql\`revoked_at IS NULL\`));
        
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
    
    // Note: socket io check will fail next operation
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
`;

code = code + "\n" + pairingEndpoints;

fs.writeFileSync('src/api/admin.ts', code);
