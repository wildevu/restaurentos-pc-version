import path from 'path';
import fs from 'fs';

export const APP_DIR = process.cwd();

function resolveDataDir(): string {
  if (process.env.RESTAURANTOS_DATA_DIR) return path.resolve(process.env.RESTAURANTOS_DATA_DIR);
  if (process.platform === 'win32') {
    const programData = process.env.ProgramData || process.env.ALLUSERSPROFILE || 'C:\\ProgramData';
    return path.join(programData, 'RestaurantOS');
  }
  return process.cwd();
}

export const DATA_DIR = resolveDataDir();
export const DB_DIR = path.join(DATA_DIR, 'data');
export const DB_PATH = path.resolve(process.env.DB_PATH || path.join(DB_DIR, 'restaurantos.db'));
export const BACKUP_DIR = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.join(DATA_DIR, 'backups');
export const LOG_DIR = process.env.LOG_DIR ? path.resolve(process.env.LOG_DIR) : path.join(DATA_DIR, 'logs');
export const CONFIG_DIR = path.join(DATA_DIR, 'config');
export const LOCK_FILE = path.join(DATA_DIR, 'restaurantos.pid');

export interface EnsureDirectoryOptions {
  strict?: boolean;
  verifyWritable?: boolean;
}

let probeSequence = 0;

/**
 * Creates all required directories. Strict callers fail immediately rather than
 * letting the app start with a database path that cannot be used. Best-effort
 * logging callers may pass strict:false so logging never prevents boot.
 */
export function ensureDirectories(options: EnsureDirectoryOptions = {}): void {
  const strict = options.strict !== false;
  const dirs = [...new Set([DATA_DIR, DB_DIR, path.dirname(DB_PATH), BACKUP_DIR, LOG_DIR, CONFIG_DIR])];

  for (const dir of dirs) {
    let probePath: string | null = null;
    let probeFd: number | null = null;
    try {
      fs.mkdirSync(dir, { recursive: true });
      if (!fs.statSync(dir).isDirectory()) {
        throw Object.assign(new Error('Configured path exists but is not a directory.'), { code: 'ENOTDIR' });
      }

      if (options.verifyWritable) {
        probeSequence += 1;
        probePath = path.join(dir, `.restaurantos-write-check-${process.pid}-${Date.now()}-${probeSequence}.tmp`);
        probeFd = fs.openSync(probePath, 'wx');
        fs.writeSync(probeFd, Buffer.from('RestaurantOS storage check'));
        fs.fsyncSync(probeFd);
        fs.closeSync(probeFd);
        probeFd = null;
        fs.unlinkSync(probePath);
        probePath = null;
      }
    } catch (err: any) {
      if (probeFd !== null) { try { fs.closeSync(probeFd); } catch {} }
      if (probePath) { try { fs.unlinkSync(probePath); } catch {} }
      const code = err?.code ? ` (${err.code})` : '';
      const message = `RestaurantOS cannot create or write to required data directory "${dir}"${code}: ${err?.message || String(err)}. Check Windows permissions, free disk space, and the configured data path.`;
      if (strict) {
        const failure: any = new Error(message);
        failure.code = err?.code || 'RESTAURANTOS_STORAGE_UNAVAILABLE';
        failure.path = dir;
        throw failure;
      }
      console.warn('[Directory Initialization]', message);
    }
  }
}
