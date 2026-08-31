import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { DB_PATH, ensureDirectories } from '../paths';
import { logger } from '../logger';

// Ensure data and database directories exist before initializing LibSQL client
ensureDirectories();

export const client = createClient({
  url: `file:${DB_PATH}`,
});

export const db = drizzle(client, { schema });

// Resolve the migrations folder reliably across dev (src/db/migrations) and production builds (migrations or dist/migrations)
export function getMigrationsFolder(): string {
  const possiblePaths = [
    path.resolve(process.cwd(), 'src/db/migrations'),
    path.resolve(process.cwd(), 'migrations'),
    path.resolve(__dirname, 'migrations'),
    path.resolve(__dirname, '../src/db/migrations'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, '_journal.json')) || fs.existsSync(path.join(p, 'meta/_journal.json'))) {
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
  const integrity = await client.execute('PRAGMA integrity_check;');
  const ok = integrity.rows[0]?.integrity_check === 'ok' || integrity.rows[0]?.[0] === 'ok';
  if (!ok) {
    throw new Error(`Database integrity check failed after migration: ${JSON.stringify(integrity.rows)}`);
  }
  
  logger.info('Database migrations and integrity checks completed successfully.');
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
