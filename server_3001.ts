import { authenticate } from './src/auth.middleware';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { runMigrations, seedDb, db } from './src/db/index';

import { config } from './src/config';
import { logger } from './src/logger';
import { authRouter } from './src/auth.routes';
import { adminRouter } from './src/api/admin';
import { hashToken } from './src/crypto';
import { sessions, users } from './src/db/schema';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { CommandPayloadSchema } from './src/schemas';
import { processCommand, getFrontendStateTx } from './src/db/queries';


const PORT = 3001;

// Zod schemas for socket events
const OpenTableSchema = z.object({ tableId: z.string() });
const AddItemSchema = z.object({ tableId: z.string(), menuItemId: z.string() });
const CloseTableSchema = z.object({ tableId: z.string() });

async function startServer() {
  logger.info('Starting RestaurantOS Local Hub...');
  
  // Initialize Database
  try {
    await runMigrations();
    logger.info('Database migrations applied successfully');
  } catch (err) {
    logger.error('Database migration failed', err);
    process.exit(1);
  }

  if (config.SEED_DB === 'true' || config.NODE_ENV !== 'production') {
    await seedDb();
  }

  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0', db: 'reachable' });
  });

  // Auth Routes
  app.use('/api/auth', authRouter);
  
  app.use('/api/admin', authenticate, adminRouter);

  // API Routes (Consider securing this later, left open for ease of integration right now, but ideal to secure it)
  app.get('/api/state', async (req, res) => {
    try {
      const { db } = require('./src/db/index'); const state = await db.transaction(async (tx: any) => await getFrontendStateTx(tx));
      res.json(state);
    } catch (err: any) {
      console.error('ERROR STACK', err.stack);
      res.status(500).json({ error: 'Internal error' });
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
        .where(and(
          eq(sessions.tokenHash, tokenHashed),
          gt(sessions.expiresAt, new Date()),
          isNull(sessions.revokedAt)
        )).limit(1);

      if (sessionRecords.length === 0 || !sessionRecords[0].users) {
        return next(new Error('Authentication error: Invalid session'));
      }
      
      const user = sessionRecords[0].users;
      if (!user.isActive || user.disabledAt) {
        return next(new Error('Authentication error: Account disabled'));
      }

      // Attach user to socket
      (socket as any).user = user;
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
        
        // In a real app we'd fetch this from hubState properly. 
        // For simplicity, we just generate a fresh state. getFrontendStateTx fetches the version internally.
        const db = require('./src/db/index').db;
        const { getFrontendStateTx } = require('./src/db/queries');
        const { hubState } = require('./src/db/schema');
        const { eq } = require('drizzle-orm');
        
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

  // Vite middleware for development
  if (config.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });

  // Graceful Shutdown
  const gracefulShutdown = () => {
    logger.info('Received shutdown signal, shutting down gracefully...');
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
}

startServer();
