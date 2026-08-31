const fs = require('fs');
let code = fs.readFileSync('src/auth.routes.ts', 'utf8');

code = code.replace("eq, and, sql } from 'drizzle-orm';", "eq, and, sql, gt } from 'drizzle-orm';");
code = code.replace("sql`expires_at > ${now.getTime()}`", "gt(pairingTokens.expiresAt, now)");

fs.writeFileSync('src/auth.routes.ts', code);
