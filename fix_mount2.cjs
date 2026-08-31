const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace("import { requireAuth } from './src/auth.routes';", "import { authenticate } from './src/auth.middleware';");
code = code.replace("app.use('/api/admin', requireAuth, adminRouter);", "app.use('/api/admin', authenticate, adminRouter);");
fs.writeFileSync('server.ts', code);
