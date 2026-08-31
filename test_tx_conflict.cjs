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

async function process(actionId) {
  try {
    return await db.transaction(async (tx) => {
      const res = await tx.insert(testTable).values({ id: actionId, val: 1 }).onConflictDoNothing();
      if (res.rowsAffected === 0) return 'duplicate';
      await new Promise(r => setTimeout(r, 200));
      return 'ok';
    });
  } catch (err) {
    return 'error: ' + err.message;
  }
}

async function run() {
  const id = crypto.randomUUID();
  const [r1, r2] = await Promise.all([process(id), process(id)]);
  console.log("R1:", r1, "R2:", r2);
}
run().catch(console.error);
