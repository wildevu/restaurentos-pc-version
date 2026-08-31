const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

if (!code.includes("import { adminRouter }")) {
  code = code.replace("import { authRouter } from './src/auth.routes';", "import { authRouter } from './src/auth.routes';\nimport { adminRouter } from './src/api/admin';");
  fs.writeFileSync('server.ts', code);
}
