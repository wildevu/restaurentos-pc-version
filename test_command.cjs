const { db } = require('./src/db/index');
const { processCommand } = require('./src/db/queries');
const { v4 } = require('uuid');

async function run() {
  try {
    const owner = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.username, 'owner2') });
    console.log("OWNER:", owner.id);
    const cmd = {
      actionId: v4(),
      type: 'OPEN_TABLE',
      payload: { tableId: 't1' },
      timestamp: new Date().toISOString()
    };
    const res = await processCommand(cmd, owner, 'client-1');
    console.log("RESULT:", res);
  } catch(e) {
    console.error("ERROR", e);
  }
}
run();
