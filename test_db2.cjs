const { createClient } = require('@libsql/client');
const client = createClient({ url: 'file:local_hub.db' });
async function run() {
  const res = await client.execute("SELECT * FROM pairing_tokens;");
  console.log(res.rows);
}
run();
