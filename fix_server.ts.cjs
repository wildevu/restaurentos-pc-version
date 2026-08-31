const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Remove duplicate imports
code = code.replace(/import { db } from '\.\/src\/db\/index';\n/g, '');

const oldSocketLogicStart = code.indexOf("socket.on('OPEN_TABLE'");
const oldSocketLogicEnd = code.indexOf("socket.on('disconnect'");

if (oldSocketLogicStart !== -1 && oldSocketLogicEnd !== -1) {
  const replacement = `
    socket.on('COMMAND', async (payload, callback) => {
      try {
        const command = CommandPayloadSchema.parse(payload);
        const result = await processCommand(command, user, socket.handshake.auth?.clientInstallationId);
        if (callback) callback({ success: true, duplicate: result.duplicate });
        if (!result.duplicate) {
          io.emit('STATE_UPDATE', result.state);
        }
      } catch (err: any) {
        logger.error(\`Command failed: \${err.message}\`);
        if (callback) callback({ success: false, error: err.message });
      }
    });

    `;
  
  code = code.slice(0, oldSocketLogicStart) + replacement + code.slice(oldSocketLogicEnd);
}

// Update /api/state to use getFrontendStateTx
code = code.replace(
  "const state = await getFrontendState();",
  "const { db } = require('./src/db/index'); const state = await db.transaction(async (tx: any) => await getFrontendStateTx(tx));"
);

// Remove unused old imports
code = code.replace("import { getFrontendState, openTable, addItem, closeTable } from './src/db/queries';", "");

fs.writeFileSync('server.ts', code);
