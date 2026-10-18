import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { DB_PATH, ensureDirectories } from '../paths';
import { logger } from '../logger';

// Safely derive module directory path for both ESM and CJS
const getCurrentDirname = () => {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
};

// Ensure data and database directories exist before initializing LibSQL client
ensureDirectories();

export let client = createClient({
  url: `file:${DB_PATH}`,
});

export let db = drizzle(client, { schema });

// Resolve the migrations folder reliably across dev (src/db/migrations) and production builds (migrations or dist/migrations)
export function getMigrationsFolder(): string {
  const currentDir = getCurrentDirname();
  const possiblePaths = [
    path.resolve(process.cwd(), 'src/db/migrations'),
    path.resolve(process.cwd(), 'migrations'),
    path.resolve(currentDir, 'migrations'),
    path.resolve(currentDir, '../src/db/migrations'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p) && (fs.existsSync(path.join(p, '_journal.json')) || fs.existsSync(path.join(p, 'meta/_journal.json')))) {
      return p;
    }
  }

  // Fallback to standard path
  return path.resolve(process.cwd(), 'src/db/migrations');
}

// Proper versioned migrations using Drizzle
export async function runMigrations() {
  const migrationsFolder = getMigrationsFolder();
  logger.info(`Running database migrations from ${migrationsFolder}...`, { dbPath: DB_PATH });
  
  await client.execute('PRAGMA foreign_keys = ON;');
  await client.execute('PRAGMA journal_mode = WAL;');
  await client.execute('PRAGMA busy_timeout = 5000;');
  
  await migrate(db, { migrationsFolder });
  
  // Verify integrity after migration
  let integrity = await client.execute('PRAGMA integrity_check;');
  let ok = integrity.rows[0]?.integrity_check === 'ok' || integrity.rows[0]?.[0] === 'ok';
  
  if (!ok) {
    logger.warn('Initial integrity check noted page fragmentation. Running VACUUM to defragment and repair...', {
      details: integrity.rows[0]?.integrity_check || integrity.rows[0]?.[0]
    });
    try {
      await client.execute('VACUUM;');
      integrity = await client.execute('PRAGMA integrity_check;');
      ok = integrity.rows[0]?.integrity_check === 'ok' || integrity.rows[0]?.[0] === 'ok';
    } catch (vErr: any) {
      logger.warn('VACUUM attempt result:', { error: vErr.message });
    }
  }

  if (!ok) {
    logger.error('Database integrity check reported unresolved issues:', { rows: integrity.rows });
    // In development mode, if severe corruption persists, recreate a fresh database rather than crashing indefinitely
    if (process.env.NODE_ENV !== 'production' && process.env.AUTO_REPAIR_DB !== 'false') {
      logger.warn('Attempting fresh database reinitialization in development mode...');
      try {
        if (fs.existsSync(DB_PATH)) {
          fs.renameSync(DB_PATH, `${DB_PATH}.corrupt.${Date.now()}`);
        }
        await migrate(db, { migrationsFolder });
        ok = true;
      } catch (rErr: any) {
        throw new Error(`Database integrity check failed after migration: ${JSON.stringify(integrity.rows)}`);
      }
    } else {
      throw new Error(`Database integrity check failed after migration: ${JSON.stringify(integrity.rows)}`);
    }
  }
  
  logger.info('Database migrations and integrity checks completed successfully.');
}

/**
 * Replace the live database only after validating an isolated staged copy.
 * The LibSQL handle is closed before the filesystem swap.
 */
export async function restoreDatabaseFile(sourcePath: string): Promise<{ rollbackPath: string }> {
  ensureDirectories();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const stagedPath = DB_PATH + '.restore-stage-' + process.pid + '-' + Date.now();
  const rollbackPath = DB_PATH + '.pre-restore-' + stamp;
  let verifier: ReturnType<typeof createClient> | null = null;
  let oldDatabaseMoved = false;

  try {
    fs.copyFileSync(sourcePath, stagedPath);
    verifier = createClient({ url: 'file:' + stagedPath });
    const integrity = await verifier.execute('PRAGMA integrity_check;');
    const integrityValue = integrity.rows[0]?.integrity_check ?? integrity.rows[0]?.[0];
    if (integrityValue !== 'ok') throw new Error('Selected backup failed SQLite integrity_check: ' + String(integrityValue));
    const requiredTables = await verifier.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('restaurants', 'tables', 'orders', 'order_items')"
    );
    const availableTables = new Set(requiredTables.rows.map((row: any) => String(row.name ?? row[0])));
    for (const required of ['restaurants', 'tables', 'orders', 'order_items']) {
      if (!availableTables.has(required)) throw new Error('Selected backup is missing required table: ' + required);
    }
  } catch (error) {
    if (verifier) { try { await verifier.close(); } catch {} }
    try { fs.unlinkSync(stagedPath); } catch {}
    throw error;
  }

  if (verifier) { await verifier.close(); verifier = null; }
  try {
    await client.execute('PRAGMA wal_checkpoint(TRUNCATE);');
    await client.close();
  } catch (closeError: any) {
    try { await client.close(); } catch {}
    client = createClient({ url: 'file:' + DB_PATH });
    db = drizzle(client, { schema });
    throw new Error('Could not safely close the active database; restore was not attempted: ' + closeError.message);
  }

  try {
    try { fs.unlinkSync(DB_PATH + '-wal'); } catch {}
    try { fs.unlinkSync(DB_PATH + '-shm'); } catch {}
    fs.renameSync(DB_PATH, rollbackPath);
    oldDatabaseMoved = true;
    fs.renameSync(stagedPath, DB_PATH);
    client = createClient({ url: 'file:' + DB_PATH });
    db = drizzle(client, { schema });
    await runMigrations();
    logger.warn('Database restore completed; previous database retained for rollback.', { rollbackPath });
    return { rollbackPath };
  } catch (restoreError) {
    try { await client.close(); } catch {}

    if (oldDatabaseMoved) {
      // Only delete the candidate replacement after the original has been moved
      // safely into rollbackPath. If moving the original failed, keep it intact.
      try { fs.unlinkSync(DB_PATH); } catch {}
      try { fs.unlinkSync(DB_PATH + '-wal'); } catch {}
      try { fs.unlinkSync(DB_PATH + '-shm'); } catch {}
      if (fs.existsSync(rollbackPath)) fs.renameSync(rollbackPath, DB_PATH);
    }

    client = createClient({ url: 'file:' + DB_PATH });
    db = drizzle(client, { schema });
    try {
      await runMigrations();
    } catch (rollbackError: any) {
      logger.error('Critical: database restore and rollback validation failed.', {
        restoreError: (restoreError as any)?.message,
        rollbackError: rollbackError?.message,
        rollbackPath
      });
      throw new Error('Database restore failed and rollback validation also failed. Preserve ' + rollbackPath + ' and contact support.');
    }
    throw restoreError;
  } finally {
    try { fs.unlinkSync(stagedPath); } catch {}
  }
}

export async function seedDb() {
  // Only run explicitly when requested or empty during initial setup
  try {
    const result = await client.execute('SELECT COUNT(*) as count FROM tables');
    const count = result.rows[0].count as number;
    
    if (count === 0) {
      logger.info('Seeding initial development demo database...');
      
      // Insert categories
      await client.execute("INSERT INTO menu_categories (id, name, display_order) VALUES ('c1', 'Coffee', 1)");
      await client.execute("INSERT INTO menu_categories (id, name, display_order) VALUES ('c2', 'Food', 2)");
      await client.execute("INSERT INTO menu_categories (id, name, display_order) VALUES ('c3', 'Dessert', 3)");

      const now = Date.now();

      // Insert items
      await client.execute({ sql: "INSERT INTO menu_items (id, category_id, name, price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", args: ['m1', 'c1', 'Espresso', 2.50, now, now] });
      await client.execute({ sql: "INSERT INTO menu_items (id, category_id, name, price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", args: ['m2', 'c1', 'Cappuccino', 3.50, now, now] });
      await client.execute({ sql: "INSERT INTO menu_items (id, category_id, name, price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", args: ['m3', 'c1', 'Iced Latte', 4.50, now, now] });
      await client.execute({ sql: "INSERT INTO menu_items (id, category_id, name, price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", args: ['m4', 'c2', 'Chicken Burger', 9.50, now, now] });
      await client.execute({ sql: "INSERT INTO menu_items (id, category_id, name, price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", args: ['m5', 'c3', 'Cheesecake', 6.00, now, now] });

      // Insert tables
      for (let i = 1; i <= 6; i++) {
        await client.execute({
          sql: "INSERT INTO tables (id, number, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
          args: [String(i), i, 'EMPTY', now, now]
        });
      }
      logger.info('Database seeded.');
    }
  } catch (err) {
    logger.warn('Seed skipped or table not initialized yet', err);
  }
}
