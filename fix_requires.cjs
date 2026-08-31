const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace("const { db } = require('./src/db/index'); const state = await db.transaction(async (tx: any) => await getFrontendStateTx(tx));", "const state = await db.transaction(async (tx: any) => await getFrontendStateTx(tx));");
code = code.replace("const { getFrontendStateTx } = require('./src/db/queries');", "");
code = code.replace("const db = require('./src/db/index').db;", "");

fs.writeFileSync('server.ts', code);
