const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace("import { authenticate } from './src/auth.middleware';", "");
code = "import { authenticate } from './src/auth.middleware';\n" + code;
fs.writeFileSync('server.ts', code);
