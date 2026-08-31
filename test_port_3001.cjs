const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/3000/g, '3001');
fs.writeFileSync('server_3001.ts', code);
