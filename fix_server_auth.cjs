const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace("app.get('/api/state', async (req, res) => {", "import { authenticate } from './src/auth.middleware';\napp.get('/api/state', authenticate, async (req, res) => {");

fs.writeFileSync('server.ts', code);
