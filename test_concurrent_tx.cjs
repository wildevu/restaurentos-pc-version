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

async function worker(id) {
  try {
    return await db.transaction(async (tx) => {
      console.log(`Worker ${id} started transaction`);
      await tx.insert(testTable).values({ id: crypto.randomUUID(), val: id });
      await new Promise(r => setTimeout(r, 500)); // Hold lock for 500ms
      console.log(`Worker ${id} finishing transaction`);
      return 'ok';
    }, { behavior: 'immediate' });
  } catch (err) {
    console.log(`Worker ${id} failed:`, err.message);
    return 'error';
  }
}

async function run() {
  await client.execute('PRAGMA busy_timeout = 5000');
  await client.execute('PRAGMA journal_mode = WAL');
  const [r1, r2] = await Promise.all([worker(1), worker(2)]);
  console.log("R1:", r1, "R2:", r2);
}
run().catch(console.error);
