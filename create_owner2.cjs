const { createClient } = require('@libsql/client');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `${salt}:${derivedKey.toString('hex')}`;
}

const client = createClient({ url: 'file:local_hub.db' });
async function run() {
  const passwordHash = hashPassword('password123');
  const restId = uuidv4();
  const now = Date.now();
  
  await client.execute({
    sql: "INSERT INTO restaurants (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
    args: [restId, 'Test Restaurant 2', now, now]
  });
  
  await client.execute({
    sql: "INSERT INTO users (id, restaurant_id, name, username, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args: [uuidv4(), restId, 'Test Owner 2', 'owner2', passwordHash, 'OWNER', 1, now, now]
  });
  console.log("Owner created!");
}
run();
