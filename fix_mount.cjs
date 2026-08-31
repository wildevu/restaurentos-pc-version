const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace("import { authRouter } from './src/api/auth';", "");
code = code.replace("const { requireAuth } = require('./src/api/auth');", "import { requireAuth } from './src/auth.routes';");
fs.writeFileSync('server.ts', code);
