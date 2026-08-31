const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/3000/g, '3001');
code = code.replace("logger.error('Failed to fetch state', { error: err.message });", "console.error('ERROR STACK', err.stack);");
fs.writeFileSync('server_3001.ts', code);
