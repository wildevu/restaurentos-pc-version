const { migrate } = require('drizzle-orm/libsql/migrator');
const { drizzle } = require('drizzle-orm/libsql');
const { createClient } = require('@libsql/client');
const path = require('path');

async function run() {
  const client = createClient({ url: 'file:local_hub.db' });
  const db = drizzle(client);
  const migrationsFolder = path.resolve(process.cwd(), 'src/db/migrations');
  try {
    await migrate(db, { migrationsFolder });
    console.log('Success');
  } catch (err) {
    console.error('Migrate error:', err);
  }
}
run();
