import { authenticate } from './src/auth.middleware';
import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { uuidv4 } from './src/utils/uuid';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { runMigrations, seedDb, db } from './src/db/index';

import { config } from './src/config';
import { logger, cleanOldLogs } from './src/logger';
import { ensureDirectories, LOCK_FILE, DB_PATH, DATA_DIR, BACKUP_DIR } from './src/paths';
import { authRouter } from './src/auth.routes';
import { adminRouter, startAutoBackupScheduler } from './src/api/admin';
import { licensingRouter, licenseEnforcementMiddleware, LicensingService } from './src/licensing/index';
import { hashToken } from './src/crypto';
import { sessions, users, devices, hubState, restaurants } from './src/db/schema';
import { eq, and, gt, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { CommandPayloadSchema } from './src/schemas';
import { processCommand, getFrontendStateTx } from './src/db/queries';

const PORT = parseInt(process.env.PORT || '8989', 10);

function getLocalLanIps(): string[] {
  const interfaces = os.networkInterfaces();
  const physicalIps: string[] = [];
  const virtualIps: string[] = [];

  const virtualKeywords = [
    'wsl',
    'hyper-v',
    'vethernet',
    'virtualbox',
    'vmware',
    'docker',
    'zerotier',
    'tailscale',
    'npcap',
    'loopback',
    'host-only'
  ];

  for (const name of Object.keys(interfaces)) {
    const isVirtual = virtualKeywords.some(keyword => name.toLowerCase().includes(keyword));

    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        // Exclude link-local APIPA addresses (169.254.x.x)
        if (iface.address.startsWith('169.254.')) {
          continue;
        }
        if (isVirtual) {
          virtualIps.push(iface.address);
        } else {
          physicalIps.push(iface.address);
        }
      }
    }
  }

  // Prioritize physical Wi-Fi/Ethernet IPs first!
  return [...physicalIps, ...virtualIps];
}

function acquireInstanceLock(): boolean {
  ensureDirectories();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(LOCK_FILE, 'wx');
      try {
        fs.writeFileSync(fd, String(process.pid), 'utf-8');
        fs.fsyncSync(fd);
      } finally { fs.closeSync(fd); }
      return true;
    } catch (error: any) {
      if (error?.code !== 'EEXIST') {
        logger.error('Unable to acquire Local Hub instance lock; refusing startup.', { error: error?.message });
        return false;
      }
      let pid = NaN;
      try { pid = Number.parseInt(fs.readFileSync(LOCK_FILE, 'utf-8').trim(), 10); } catch {}
      if (Number.isInteger(pid) && pid > 0) {
        try {
          process.kill(pid, 0);
          logger.error('Another process owns the Local Hub lock; refusing a second instance.', { pid });
          return false;
        } catch (probeError: any) {
          if (probeError?.code === 'EPERM') {
            logger.error('The existing process is alive but cannot be inspected; refusing a second instance.', { pid });
            return false;
          }
        }
      }
      try {
        fs.unlinkSync(LOCK_FILE);
        logger.warn('Removed stale Local Hub lock file.', { previousPid: Number.isFinite(pid) ? pid : null });
      } catch (unlinkError: any) {
        logger.error('Could not remove stale Local Hub lock; refusing startup.', { error: unlinkError?.message });
        return false;
      }
    }
  }
  logger.error('Could not acquire Local Hub lock after stale-lock recovery.');
  return false;
}

function releaseInstanceLock(): void {
  try {
    const owner = Number.parseInt(fs.readFileSync(LOCK_FILE, 'utf-8').trim(), 10);
    if (owner === process.pid) fs.unlinkSync(LOCK_FILE);
  } catch {}
}

async function startServer() {
  logger.info('Starting RestaurantOS Local Hub...', {
    version: '1.0.0',
    platform: process.platform,
    dataDir: DATA_DIR,
    dbPath: DB_PATH
  });
  
  ensureDirectories();
  if (!acquireInstanceLock()) {
    logger.error('RestaurantOS Local Hub is already running or its lock could not be acquired. Exiting without touching the active instance.');
    process.exit(1);
  }
  cleanOldLogs();
  
  // Clean logs every 24 hours
  setInterval(() => cleanOldLogs(), 24 * 60 * 60 * 1000);

  let isServerReady = false;

  // Initialize Database
  try {
    await runMigrations();
    logger.info('Database migrations applied successfully');
  } catch (err: any) {
    logger.error('Database migration failed', { error: err.message });
    process.exit(1);
  }

  // Security Hardening: Demo seeding is STRICTLY forbidden in production
  if (config.NODE_ENV !== 'production' && config.SEED_DB === 'true') {
    await seedDb();
  } else if (config.NODE_ENV === 'production' && config.SEED_DB === 'true') {
    logger.warn('SEED_DB=true is ignored in production mode to prevent customer data mutation.');
  }

  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    maxHttpBufferSize: 5e7 // 50MB buffer limit
  });
  app.set('io', io);

  const lanIps = getLocalLanIps();
  app.set('lanIps', lanIps);

  // Helper to disconnect active sockets when a user is deactivated or password changed
  const disconnectUserSockets = (userId: string) => {
    io.sockets.sockets.forEach((s: any) => {
      if (s.user && s.user.id === userId) {
        s.emit('AUTH_REVOKED', { reason: 'User session terminated or deactivated' });
        s.disconnect(true);
      }
    });
  };

  // Helper to disconnect active sockets when a device is revoked
  const disconnectDeviceSockets = (deviceId: string) => {
    io.sockets.sockets.forEach((s: any) => {
      if (s.deviceId === deviceId) {
        s.emit('AUTH_REVOKED', { reason: 'Device authorization revoked' });
        s.disconnect(true);
      }
    });
  };

  app.set('disconnectUserSockets', disconnectUserSockets);
  app.set('disconnectDeviceSockets', disconnectDeviceSockets);

  let gracefulShutdown: (reason?: string) => Promise<void>;

  // Correlation ID, CORS & Security Headers Middleware
  app.use((req: any, res: any, next) => {
    const reqId = req.headers['x-request-id'] || `req_${uuidv4().substring(0, 8)}`;
    req.id = reqId;
    res.setHeader('x-request-id', reqId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-request-id');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Body parsers with generous limits for image uploads, database backups, and batch orders
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Global Payload & JSON Parsing Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    if (err.type === 'entity.too.large' || err.status === 413) {
      logger.warn('Payload too large error intercepted', { path: req.path, ip: req.ip });
      return res.status(413).json({ error: 'Request payload is too large (maximum 50MB supported).' });
    }
    if (err instanceof SyntaxError && 'body' in err) {
      logger.warn('Malformed JSON body intercepted', { path: req.path });
      return res.status(400).json({ error: 'Malformed JSON payload.' });
    }
    next(err);
  });

  // Health / Liveness Check
  app.get(['/health', '/api/health'], (req, res) => {
    res.json({ 
      status: 'ok', 
      version: '1.0.0', 
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  });

  // Readiness Check (Validates server state, DB connectivity, and table query)
  app.get('/api/ready', async (req: any, res) => {
    if (!isServerReady) {
      return res.status(503).json({
        ready: false,
        status: 'initializing',
        message: 'RestaurantOS Local Hub is starting up...'
      });
    }

    try {
      await db.run(sql.raw('SELECT 1 as alive;'));
      const hub = await db.select().from(hubState).limit(1);
      res.json({
        ready: true,
        status: 'ready',
        database: 'connected',
        stateInitialized: hub.length > 0,
        version: '1.0.0',
        lanIps,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      logger.error('Readiness probe failed', { error: err.message, reqId: req.id });
      res.status(503).json({ ready: false, status: 'error', error: err.message });
    }
  });

  // Public Local Hub Status Screen Endpoint (Safe summary without credentials)
  app.get('/api/hub/status', async (req: any, res) => {
    try {
      const rest = await db.select().from(restaurants).limit(1);
      const restaurantName = rest[0]?.name || 'RestaurantOS Hub';

      let backupCount = 0;
      let lastBackupTime: Date | null = null;
      if (fs.existsSync(BACKUP_DIR)) {
        const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db'));
        backupCount = files.length;
        if (files.length > 0) {
          const times = files.map(f => fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs);
          lastBackupTime = new Date(Math.max(...times));
        }
      }

      const connectedSockets = io.sockets.sockets.size;

      res.json({
        hubName: 'RestaurantOS Local Hub',
        restaurantName,
        status: 'RUNNING',
        version: '1.0.0',
        port: PORT,
        lanIps,
        primaryLanUrl: lanIps.length > 0 ? `http://${lanIps[0]}:${PORT}` : `http://localhost:${PORT}`,
        connectedDevices: connectedSockets,
        database: {
          status: 'HEALTHY',
          mode: 'WAL',
        },
        backups: {
          status: 'HEALTHY',
          totalBackups: backupCount,
          lastBackupAt: lastBackupTime,
        },
        uptimeSeconds: Math.floor(process.uptime()),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Localhost Administrative Graceful Shutdown Endpoint (Safe cross-platform shutdown)
  app.post('/api/hub/shutdown', (req: any, res) => {
    const remoteIp = req.socket?.remoteAddress || '';
    const isLocal = remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp === '::ffff:127.0.0.1' || remoteIp === 'localhost';
    if (!isLocal) {
      return res.status(403).json({ error: 'Shutdown endpoint is restricted to localhost requests only.' });
    }
    logger.info('Graceful shutdown requested via local API endpoint.');
    res.json({ status: 'shutting_down' });
    setTimeout(() => {
      if (gracefulShutdown) {
        gracefulShutdown('LOCAL_API');
      } else {
        process.exit(0);
      }
    }, 50);
  });

  // Auth & Licensing Routes (Public / Unauthenticated Access)
  app.use('/api/auth', authRouter);
  app.use('/api/licensing', licensingRouter);

  // Authoritative Offline Licensing Enforcement Middleware
  app.use(licenseEnforcementMiddleware);
  
  app.use('/api/admin', authenticate, adminRouter);

  // Frontend State Route
  app.get('/api/state', authenticate, async (req: any, res) => {
    try {
      const state = await db.transaction(async (tx: any) => {
        const versionRow = await tx.select().from(hubState)
          .where(eq(hubState.restaurantId, req.user.restaurantId)).get();
        return getFrontendStateTx(tx, versionRow?.version || 0);
      });
      res.json(state);
    } catch (err: any) {
      logger.error('Failed to fetch state', { error: err.message, reqId: req.id });
      res.status(500).json({ error: 'Internal error', errorId: req.id });
    }
  });

  // Websockets Authentication Middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const tokenHashed = hashToken(token);
      const sessionRecords = await db.select()
        .from(sessions)
        .leftJoin(users, eq(sessions.userId, users.id))
        .leftJoin(devices, eq(sessions.deviceId, devices.id))
        .where(and(
          eq(sessions.tokenHash, tokenHashed),
          gt(sessions.expiresAt, new Date()),
          isNull(sessions.revokedAt)
        )).limit(1);

      if (sessionRecords.length === 0 || !sessionRecords[0].users) {
        return next(new Error('Authentication error: Invalid session'));
      }

      if (sessionRecords[0].devices && sessionRecords[0].devices.revokedAt) {
        return next(new Error('Authentication error: Device has been revoked'));
      }
      
      const user = sessionRecords[0].users;
      if (!user.isActive || user.disabledAt) {
        return next(new Error('Authentication error: Account disabled'));
      }

      // Update session last seen timestamp
      try {
        await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, sessionRecords[0].sessions.id));
      } catch {}

      // Attach user and device to socket
      (socket as any).user = user;
      (socket as any).deviceId = sessionRecords[0].sessions.deviceId;
      (socket as any).sessionId = sessionRecords[0].sessions.id;
      next();
    } catch (err) {
      logger.error('Socket authentication error', err);
      next(new Error('Authentication error: Internal error'));
    }
  });

  // Websockets for live collaboration
  io.on('connection', (socket) => {
    const user = (socket as any).user;
    logger.info('Client connected via socket', { userId: user.id, username: user.username });

    socket.on('COMMAND', async (payload, callback) => {
      try {
        const licenseCheck = await LicensingService.getStatus();
        if (!licenseCheck.canOperate) {
          logger.warn('Operational command blocked due to inactive/expired license', {
            status: licenseCheck.status,
            userId: user.id,
          });
          if (callback) callback({
            success: false,
            retryable: false,
            error: licenseCheck.status === 'EXPIRED'
              ? 'RestaurantOS license has expired. Please renew the license.'
              : 'Active RestaurantOS license required to perform actions.',
          });
          return;
        }

        const command = CommandPayloadSchema.parse(payload);
        const result = await processCommand(command, user, socket.handshake.auth?.clientInstallationId);
        
        // Acknowledge the command, including the stateVersion it produced or resolved to
        if (callback) callback({ success: true, duplicate: result.duplicate, stateVersion: result.stateVersion });
        
        // Broadcast the new state to all clients if this was a new mutation
        if (!result.duplicate && result.state) {
          io.emit('STATE_UPDATE', result.state);
        }
      } catch (err: any) {
        logger.error(`Command failed: ${err.message}`);
        let isRetryable = true;
        if (err && err.name === 'CommandError') {
          isRetryable = err.isRetryable;
        } else if (err && err.name === 'ZodError') {
          isRetryable = false;
        }
        if (callback) callback({ success: false, retryable: isRetryable, error: err.message });
      }
    });

    socket.on('SYNC', async (payload, callback) => {
      try {
        const suppliedVersion = Number(payload?.lastKnownVersion);
        const lastKnownVersion = Number.isSafeInteger(suppliedVersion) && suppliedVersion >= 0 ? suppliedVersion : 0;
        const response = await db.transaction(async (tx: any) => {
          const stateRow = await tx.select().from(hubState)
            .where(eq(hubState.restaurantId, user.restaurantId)).get();
          const currentVersion = stateRow?.version || 0;
          if (currentVersion !== lastKnownVersion || lastKnownVersion === 0) {
            return { upToDate: false, state: await getFrontendStateTx(tx, currentVersion) };
          }
          return { upToDate: true, stateVersion: currentVersion };
        });
        if (callback) callback(response);
      } catch (err: any) {
        logger.error('Sync failed', { error: err.message, userId: user.id });
        if (callback) callback({ error: 'Synchronization failed. Retry when the hub is available.' });
      }
    });

    socket.on('disconnect', () => {
      logger.info('Client disconnected', { userId: user.id });
    });
  });

  // Vite middleware for development vs Static PWA Serving in Production
  if (config.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Look for dist folder in current working directory or app directory
    const distPath = path.join(process.cwd(), 'dist');
      
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html') || filePath.endsWith('manifest.webmanifest') || filePath.endsWith('sw.js')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));
    app.get('*all', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        logger.error(`Frontend assets missing at ${distPath}. index.html not found.`);
        res.status(500).type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>RestaurantOS Local Hub — Error</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { max-width: 580px; padding: 32px; background: #1e293b; border-radius: 12px; border: 1px solid #334155; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h1 { color: #f87171; font-size: 22px; margin: 0 0 14px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 16px; }
    .path-box { background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 10px; color: #38bdf8; font-family: monospace; font-size: 13px; word-break: break-all; margin-bottom: 16px; text-align: left; }
  </style>
</head>
<body>
  <div class="card">
    <h1>RestaurantOS Frontend Assets Not Found</h1>
    <p>The static user interface files could not be located at the expected application path:</p>
    <div class="path-box">${distPath}</div>
    <p>Please ensure that RestaurantOS was installed completely, or reinstall using the official installer.</p>
  </div>
</body>
</html>`);
      }
    });
  }

  // Graceful EADDRINUSE Error Handling
  httpServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`[PORT CONFLICT] Port ${PORT} is already in use by another application or another instance of RestaurantOS Local Hub. Please ensure no other server is running on port ${PORT}.`);
      releaseInstanceLock();
      process.exit(1);
    } else {
      logger.error('HTTP Server Error:', err);
    }
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    isServerReady = true;
    logger.info(`====================================================`);
    logger.info(`   RESTAURANTOS LOCAL HUB — SERVER RUNNING          `);
    logger.info(`====================================================`);
    logger.info(`Local PC Address: http://localhost:${PORT}`);
    if (lanIps.length > 0) {
      lanIps.forEach(ip => {
        logger.info(`Restaurant LAN Access URL: http://${ip}:${PORT}`);
      });
    }
    logger.info(`PWA Service: Enabled and serving to LAN devices`);
    logger.info(`Data Directory: ${DATA_DIR}`);
    logger.info(`Database Path: ${DB_PATH}`);
    logger.info(`====================================================`);
    
    startAutoBackupScheduler();
  });

  // Graceful Shutdown
  let isShuttingDown = false;
  gracefulShutdown = async (triggerReason: string = 'UNKNOWN') => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received shutdown trigger (${triggerReason}), shutting down gracefully...`);

    // Safety timeout in case open connections linger
    const forceTimer = setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      try {
        releaseInstanceLock();
      } catch {}
      process.exit(1);
    }, 10000);

    if (forceTimer.unref) {
      forceTimer.unref();
    }

    try {
      // 1. Close WebSockets / Socket.IO
      await new Promise<void>((resolve) => {
        try {
          io.close(() => {
            logger.info('Socket.IO server closed.');
            resolve();
          });
        } catch {
          resolve();
        }
      });

      // 2. Close HTTP Server and idle connections
      if (typeof httpServer.closeIdleConnections === 'function') {
        httpServer.closeIdleConnections();
      }

      await new Promise<void>((resolve) => {
        try {
          httpServer.close(() => {
            logger.info('HTTP server closed.');
            resolve();
          });
        } catch {
          resolve();
        }
      });

      // 3. Flush database WAL checkpoint
      try {
        await db.run(sql.raw('PRAGMA wal_checkpoint(TRUNCATE);'));
        logger.info('Database WAL checkpoint completed.');
      } catch (dbErr) {
        logger.warn('Error during shutdown WAL checkpoint:', dbErr);
      }

      // 4. Release lockfile AFTER servers and database checkpoint are complete
      releaseInstanceLock();
      logger.info('Graceful shutdown completed successfully.');

      clearTimeout(forceTimer);
      process.exit(0);
    } catch (shutdownErr) {
      logger.error('Error during graceful shutdown:', shutdownErr);
      try {
        releaseInstanceLock();
      } catch {}
      clearTimeout(forceTimer);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Cross-platform STDIN listener (for Windows service wrappers, pipes, and test harnesses)
  if (process.stdin.isTTY === false || process.env.NODE_ENV === 'production') {
    try {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => {
        if (chunk.toString().trim() === 'SHUTDOWN') {
          gracefulShutdown('STDIN');
        }
      });
    } catch {}
  }

  process.once('uncaughtException', (err) => {
    logger.error('Uncaught Exception; exiting so the Windows supervisor can restart from a known state.', err);
    void gracefulShutdown('UNCAUGHT_EXCEPTION').finally(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection; exiting so the Windows supervisor can restart from a known state.', { reason });
    void gracefulShutdown('UNHANDLED_REJECTION').finally(() => process.exit(1));
  });
}

startServer();
