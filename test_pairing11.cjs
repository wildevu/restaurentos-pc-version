const { db } = require('./src/db/index');
const { getFrontendStateTx } = require('./src/db/queries');
async function run() {
  try {
    await db.transaction(async (tx) => await getFrontendStateTx(tx));
    console.log("SUCCESS");
  } catch(e) {
    console.error(e);
  }
}
run();
