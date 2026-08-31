import { Request, Response, NextFunction } from 'express';
import { db } from './db/index';
import { users, sessions, restaurants, auditEvents, devices } from './db/schema';
import { eq, and, sql, gt, isNull } from 'drizzle-orm';
import { hashPassword, verifyPassword, generateToken, hashToken } from './crypto';
import { SetupPayloadSchema, LoginPayloadSchema } from './schemas';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';

// --- In-Memory Rate Limiter for Login ---
const loginAttempts = new Map<string, { count: number, resetAt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

function isRateLimited(username: string): boolean {
  const attempt = loginAttempts.get(username);
  if (!attempt) return false;
  if (Date.now() > attempt.resetAt) {
    loginAttempts.delete(username);
    return false;
  }
  return attempt.count >= MAX_ATTEMPTS;
}

function recordFailedLogin(username: string) {
  const attempt = loginAttempts.get(username);
  if (attempt && Date.now() <= attempt.resetAt) {
    attempt.count++;
  } else {
    loginAttempts.set(username, { count: 1, resetAt: Date.now() + LOCKOUT_MS });
  }
}

// --- Express Middleware to Require Auth ---
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const tokenHashed = hashToken(token);
  
  try {
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
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    if (sessionRecords[0].devices && sessionRecords[0].devices.revokedAt) {
      return res.status(401).json({ error: 'Device has been revoked' });
    }
    
    const user = sessionRecords[0].users;
    if (!user.isActive || user.disabledAt) {
      return res.status(403).json({ error: 'Account disabled' });
    }
    
    // Attach to request
    (req as any).user = user;
    (req as any).session = sessionRecords[0].sessions;
    (req as any).device = sessionRecords[0].devices || null;
    next();
  } catch (err) {
    logger.error('Authentication error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient role' });
    }
    next();
  };
}
