const fs = require('fs');
let code = fs.readFileSync('src/api/admin.ts', 'utf8');

code = code.replace("sql`used_at IS NULL AND invalidated_at IS NULL AND expires_at > ${new Date().getTime()}`", "sql`used_at IS NULL AND invalidated_at IS NULL AND expires_at > ${Math.floor(new Date().getTime() / 1000)}`");

fs.writeFileSync('src/api/admin.ts', code);
