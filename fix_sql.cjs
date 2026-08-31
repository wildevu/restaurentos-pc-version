const fs = require('fs');
let code = fs.readFileSync('src/api/admin.ts', 'utf8');

code = code.replace(/sql\\`\\\$\\{hubState\.version\\} \+ 1\\`/g, "sql`${hubState.version} + 1`");
code = code.replace(/sql\\`archived_at IS NULL\\`/g, "sql`archived_at IS NULL`");
fs.writeFileSync('src/api/admin.ts', code);
