const { createClient } = require('@libsql/client');
const client = createClient({ url: 'file:test_tx.db?busy_timeout=5000' });
client.execute('SELECT 1').then(() => console.log('success')).catch(console.error);
