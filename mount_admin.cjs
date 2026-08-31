const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace("import { authRouter } from './src/api/auth';", "import { authRouter } from './src/api/auth';\nimport { adminRouter } from './src/api/admin';");
code = code.replace("app.use('/api/auth', authRouter);", "app.use('/api/auth', authRouter);\n  const { requireAuth } = require('./src/api/auth');\n  app.use('/api/admin', requireAuth, adminRouter);");
fs.writeFileSync('server.ts', code);
