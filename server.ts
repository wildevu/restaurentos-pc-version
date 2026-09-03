import { authenticate } from './src/auth.middleware';
import express from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { runMigrations, seedDb, db } from './src/db/index';

import { config } from './src/config';
import { logger, cleanOldLogs } from './src/logger';
import { ensureDirectories, LOCK_FILE, DB_PATH, DATA_DIR, BACKUP_DIR } from './src/paths';
import { authRouter } from './src/auth.routes';
import { adminRouter, startAutoBackupScheduler } from './src/api/admin';
import { hashToken } from './src/crypto';
import { sessions, users, devices, hubState, restaurants } from './src/db/schema';
import { eq, and, gt, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { CommandPayloadSchema } from './src/schemas';
import { processCommand, getFrontendStateTx } from './src/db/queries';

const PORT = 3000;

function getLocalLanIps(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

function acquireInstanceLock(): boolean {
  ensureDirectories();
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const pidStr = fs.readFileSync(LOCK_FILE, 'utf-8').trim();
      const pid = parseInt(pidStr, 10);
      if (!isNaN(pid)) {
        try {
          // Check if process with that PID is still running
          process.kill(pid, 0);
          logger.warn(`Another instance of RestaurantOS Local Hub is already running (PID: ${pid})`);
          return true; // Still allow server to attempt port binding; PID check is informational
        } catch {
          // Process not running, stale lock file
          logger.info(`Cleaning up stale lockfile from PID ${pid}`);
        }
      }
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid), 'utf-8');
  } catch (err) {
    logger.warn('Lockfile handling note:', err);
  }
  return true;
}

function releaseInstanceLock(): void {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
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
  acquireInstanceLock();
  cleanOldLogs();
  
  // Clean logs every 24 hours
  setInterval(() => cleanOldLogs(), 24 * 60 * 60 * 1000);

  // Initialize Database
  try {
    await runMigrations();
    logger.info('Database migrations applied successfully');
  } catch (err: any) {
    logger.error('Database migration failed', { error: err.message });
    process.exit(1);
  }

  if (config.SEED_DB === 'true') {
    await seedDb();
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

  // Correlation ID & Security Headers Middleware
  app.use((req: any, res: any, next) => {
    const reqId = req.headers['x-request-id'] || `req_${uuidv4().substring(0, 8)}`;
    req.id = reqId;
    res.setHeader('x-request-id', reqId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
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

  // Readiness Check (Validates DB connectivity, foreign keys, and tables)
  app.get('/api/ready', async (req: any, res) => {
    try {
      await db.run(sql.raw('SELECT 1 as alive;'));
      const hub = await db.select().from(hubState).limit(1);
      res.json({
        ready: true,
        database: 'connected',
        stateInitialized: hub.length > 0,
        lanIps,
        uptimeSeconds: Math.floor(process.uptime())
      });
    } catch (err: any) {
      logger.error('Readiness probe failed', { error: err.message, reqId: req.id });
      res.status(503).json({ ready: false, error: err.message });
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

  // Auth Routes
  app.use('/api/auth', authRouter);
  
  app.use('/api/admin', authenticate, adminRouter);

  // Frontend State Route
  app.get('/api/state', authenticate, async (req: any, res) => {
    try {
      const state = await db.transaction(async (tx: any) => await getFrontendStateTx(tx));
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
        const lastKnownVersion = payload?.lastKnownVersion || 0;
        
        const stateRes = await db.select().from(hubState).where(eq(hubState.restaurantId, user.restaurantId)).get();
        const currentVersion = stateRes?.version || 0;
        
        if (currentVersion > lastKnownVersion || lastKnownVersion === 0) {
          const state = await getFrontendStateTx(db, currentVersion);
          if (callback) callback({ upToDate: false, state });
        } else {
          if (callback) callback({ upToDate: true, stateVersion: currentVersion });
        }
      } catch (err: any) {
        logger.error(`Sync failed: ${err.message}`);
        if (callback) callback({ error: err.message });
      }
    });

    socket.on('disconnect', () => {
      logger.info('Client disconnected', { userId: user.id });
    });
  });

  // Vite middleware for development vs Static PWA Serving in Production
  if (config.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Look for dist folder in current working directory or app directory
    const distPath = path.join(process.cwd(), 'dist');
      
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).send('RestaurantOS Local Hub is initializing...');
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
  const gracefulShutdown = async () => {
    logger.info('Received shutdown signal, shutting down gracefully...');
    try {
      await db.run(sql.raw('PRAGMA wal_checkpoint(TRUNCATE);'));
    } catch {}
    
    releaseInstanceLock();

    io.close(() => {
      logger.info('Socket.IO server closed.');
    });

    httpServer.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
    
    // Force shutdown after 10s
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', err);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection', { reason });
  });
}

startServer();
