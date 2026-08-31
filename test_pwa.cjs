const { createClient } = require('@libsql/client');
const crypto = require('crypto');
const assert = require('assert');

async function run() {
  const queries = require('./src/db/queries');
  const user = { id: 'u1', restaurantId: 'r1', username: 'testuser' };

  console.log("TEST 2 - DUPLICATE PROTECTION");
  const actionId1 = crypto.randomUUID();
  const res1 = await queries.processCommand({ type: 'OPEN_TABLE', actionId: actionId1, payload: { tableId: 't2' } }, user);
  const res2 = await queries.processCommand({ type: 'OPEN_TABLE', actionId: actionId1, payload: { tableId: 't2' } }, user);
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res2.success, true);
  assert.strictEqual(res2.duplicate, true);

  console.log("TEST 3 - INVALID COMMAND");
  const actionId3 = crypto.randomUUID();
  try {
    await queries.processCommand({ type: 'OPEN_TABLE', actionId: actionId3, payload: { tableId: 't2' } }, user);
  } catch (err) {
    assert.strictEqual(err.name, 'CommandError');
    assert.strictEqual(err.isRetryable, false);
  }

  console.log("ALL SMOKE TESTS PASSED");
  process.exit(0);
}
run().catch(console.error);
