const fs = require('fs');
let code = fs.readFileSync('src/auth.routes.ts', 'utf8');

code = code.replace("restaurants, users, sessions, devices, auditEvents", "restaurants, users, sessions, devices, auditEvents, pairingTokens");

const usePairingEndpoint = `
authRouter.post('/pair', async (req, res) => {
  try {
    const schema = z.object({
      token: z.string().min(1),
      deviceId: z.string().min(1)
    });
    const payload = schema.parse(req.body);
    
    const tokenHash = hashToken(payload.token);
    const now = new Date();
    
    // Find the valid pairing token
    const tokenRecords = await db.select()
      .from(pairingTokens)
      .where(and(
        eq(pairingTokens.tokenHash, tokenHash),
        sql\`used_at IS NULL\`,
        sql\`invalidated_at IS NULL\`,
        sql\`expires_at > \${now.getTime()}\`
      ))
      .limit(1);
      
    if (tokenRecords.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired pairing code' });
    }
    
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
`;

code = code.replace("import { z } from 'zod';", "import { z } from 'zod';"); // ensure Zod is imported... oh wait, schemas has SetupPayloadSchema etc, I should import z.
if (!code.includes("import { z } from 'zod';")) {
  code = code.replace("import { v4 as uuidv4 } from 'uuid';", "import { v4 as uuidv4 } from 'uuid';\nimport { z } from 'zod';");
}

code = code.replace("authRouter.post('/login',", usePairingEndpoint + "\n\nauthRouter.post('/login',");

fs.writeFileSync('src/auth.routes.ts', code);
