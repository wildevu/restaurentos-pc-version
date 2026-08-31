const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace("import { authenticate } from './src/auth.middleware';app.get('/api/state', authenticate, async (req, res) => {", "app.get('/api/state', authenticate, async (req, res) => {");

fs.writeFileSync('server.ts', code);
