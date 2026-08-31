const { createClient } = require('@libsql/client');
const client = createClient({ url: 'file:local_hub.db' });

async function run() {
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        actor_user_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    
    // Add columns if they don't exist
    const addColumn = async (table, col, def) => {
      try {
        await client.execute(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
      } catch (e) {
        if (!e.message.includes('duplicate column')) console.error(e.message);
      }
    };
    
    await addColumn('menu_items', 'archived_at', 'INTEGER');
    await addColumn('orders', 'opened_by_user_id', 'TEXT REFERENCES users(id)');
    await addColumn('orders', 'closed_by_user_id', 'TEXT REFERENCES users(id)');
    await addColumn('order_items', 'added_by_user_id', 'TEXT REFERENCES users(id)');
    await addColumn('order_items', 'notes', 'TEXT');
    
    console.log('Database fixed!');
  } catch (err) {
    console.error(err);
  }
}
run();
