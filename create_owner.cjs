const { createClient } = require('@libsql/client');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const client = createClient({ url: 'file:local_hub.db' });
async function run() {
  const passwordHash = bcrypt.hashSync('password123', 10);
  const restId = uuidv4();
  const now = Date.now();
  
  await client.execute({
    sql: "INSERT INTO restaurants (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
    args: [restId, 'Test Restaurant', now, now]
  });
  
  await client.execute({
    sql: "INSERT INTO users (id, restaurant_id, name, username, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args: [uuidv4(), restId, 'Test Owner', 'owner', passwordHash, 'OWNER', 1, now, now]
  });
  console.log("Owner created!");
}
run();
