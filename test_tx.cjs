const { createClient } = require('@libsql/client');
const { drizzle } = require('drizzle-orm/libsql');
const { sqliteTable, text, integer } = require('drizzle-orm/sqlite-core');
const crypto = require('crypto');

const client = createClient({ url: 'file:test_tx.db' });
const db = drizzle(client);

const testTable = sqliteTable('test_table', {
  id: text('id').primaryKey(),
  val: integer('val'),
});

async function run() {
  await db.run('CREATE TABLE IF NOT EXISTS test_table (id TEXT PRIMARY KEY, val INTEGER)');
  
  await db.transaction(async (tx) => {
    await tx.insert(testTable).values({ id: '1', val: 1 }).onConflictDoNothing();
  }, { behavior: 'immediate' });
  
  console.log("SUCCESS");
}
run().catch(console.error);
