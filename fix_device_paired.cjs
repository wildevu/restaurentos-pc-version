const fs = require('fs');
let code = fs.readFileSync('src/auth.routes.ts', 'utf8');

code = code.replace(
`        deviceId = uuidv4();
        await tx.insert(devices).values({
          id: deviceId,
          restaurantId: user.restaurantId,
          deviceIdentifier: payload.deviceId,
          createdAt: now,
          lastSeenAt: now,
        });`,
`        deviceId = uuidv4();
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
        });`
);

fs.writeFileSync('src/auth.routes.ts', code);
