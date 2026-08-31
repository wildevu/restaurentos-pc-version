const fs = require('fs');
let code = fs.readFileSync('src/api/admin.ts', 'utf8');

code = code.replace(
  "import { eq, and, not, sql } from 'drizzle-orm';",
  "import { eq, and, not, sql, isNull, asc } from 'drizzle-orm';"
);

code = code.replace(
  "const { isNull, asc } = require('drizzle-orm');",
  ""
);

fs.writeFileSync('src/api/admin.ts', code);
