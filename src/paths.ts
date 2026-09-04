import path from 'path';
import fs from 'fs';

// Resolve Application Directory (where code and binary assets reside)
export const APP_DIR = process.cwd();

// Resolve Data Directory (where restaurant database, backups, logs, and config reside)
// Production on Windows uses C:\ProgramData\RestaurantOS\
// Development and custom environments can override via RESTAURANTOS_DATA_DIR
function resolveDataDir(): string {
  if (process.env.RESTAURANTOS_DATA_DIR) {
    return path.resolve(process.env.RESTAURANTOS_DATA_DIR);
  }
  
  if (process.platform === 'win32') {
    const programData = process.env.ProgramData || process.env.ALLUSERSPROFILE || 'C:\\ProgramData';
    return path.join(programData, 'RestaurantOS');
  }
  
  // Default to project directory in non-Windows/development environments
  return process.cwd();
}

export const DATA_DIR = resolveDataDir();
export const DB_DIR = path.join(DATA_DIR, 'data');
export const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'restaurantos.db');
export const BACKUP_DIR = process.env.BACKUP_DIR || path.join(DATA_DIR, 'backups');
export const LOG_DIR = process.env.LOG_DIR || path.join(DATA_DIR, 'logs');
export const CONFIG_DIR = path.join(DATA_DIR, 'config');
export const LOCK_FILE = path.join(DATA_DIR, 'restaurantos.pid');

export function ensureDirectories(): void {
  const dirs = [DATA_DIR, DB_DIR, BACKUP_DIR, LOG_DIR, CONFIG_DIR];
  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      console.warn(`[Directory Initialization] Warning for ${dir}:`, err);
    }
  }
}
