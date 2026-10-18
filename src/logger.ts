import fs from 'fs';
import path from 'path';
import { LOG_DIR, ensureDirectories } from './paths';

// Ensure the log directory exists
ensureDirectories();

// A detached Windows launcher or a closed terminal can invalidate stdout/stderr.
// File logging below is the durable record, so console stream errors must be non-fatal.
function protectConsoleStream(stream: any) {
  if (!stream || typeof stream.on !== 'function') return;
  stream.on('error', (error: any) => {
    if (error?.code === 'EPIPE' || error?.code === 'EBADF') return;
    try {
      const timestamp = new Date().toISOString();
      const logFilePath = path.join(LOG_DIR, `restaurantos-${timestamp.split('T')[0]}.log`);
      fs.appendFileSync(logFilePath, JSON.stringify({
        timestamp,
        level: 'ERROR',
        message: 'Console output stream failed',
        meta: { code: error?.code, message: error?.message }
      }) + '\\n', 'utf-8');
    } catch {}
  });
}
protectConsoleStream(process.stdout);
protectConsoleStream(process.stderr);

export const logger = {
  info: (msg: string, meta?: any) => log('INFO', msg, meta),
  warn: (msg: string, meta?: any) => log('WARN', msg, meta),
  error: (msg: string, meta?: any) => log('ERROR', msg, meta),
};

function log(level: string, message: string, meta?: any) {
  // Never log passwords, tokens, bearer headers, pairing secrets, or hashes
  const safeMeta = meta ? sanitize(meta) : undefined;
  
  const now = new Date();
  const timestamp = now.toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(safeMeta && { meta: safeMeta }),
  };

  const jsonStr = JSON.stringify(logEntry);

  // 1. Best-effort console output. Keep durable file logging independent from it.
  try {
    if (level === 'ERROR') {
      console.error(jsonStr);
    } else if (level === 'WARN') {
      console.warn(jsonStr);
    } else {
      console.log(jsonStr);
    }
  } catch {
    // Console output is optional and must not affect restaurant operations.
  }

  // 2. Safe File Logging with Daily Rotation
  try {
    const dateStr = timestamp.split('T')[0]; // YYYY-MM-DD
    const logFilePath = path.join(LOG_DIR, `restaurantos-${dateStr}.log`);
    fs.appendFileSync(logFilePath, jsonStr + '\n', 'utf-8');
  } catch {
    // Fail silently on disk logging errors so core app is never disrupted
  }
}

export function cleanOldLogs(maxDays = 14) {
  try {
    if (!fs.existsSync(LOG_DIR)) return;
    const files = fs.readdirSync(LOG_DIR).filter(f => f.startsWith('restaurantos-') && f.endsWith('.log'));
    const now = Date.now();
    const maxAgeMs = maxDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      const fullPath = path.join(LOG_DIR, file);
      try {
        const stats = fs.statSync(fullPath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(fullPath);
        }
      } catch {}
    }
  } catch {}
}

function sanitize(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (obj instanceof Error) {
    return { name: obj.name, message: obj.message, stack: obj.stack };
  }
  if (Array.isArray(obj)) return obj.map(sanitize);
  
  const copy = { ...obj };
  const sensitiveKeys = ['password', 'passwordhash', 'token', 'hash', 'secret', 'auth', 'authorization', 'cookie', 'pin', 'key'];
  
  for (const key of Object.keys(copy)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().replace(/[^a-z]/g, '').includes(sk))) {
      copy[key] = '[REDACTED]';
    } else if (typeof copy[key] === 'object') {
      copy[key] = sanitize(copy[key]);
    }
  }
  return copy;
}
