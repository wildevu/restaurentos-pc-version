const fs = require('fs');
let code = fs.readFileSync('src/db/queries.ts', 'utf8');

code = code.replace("import { eq, and, asc, sql } from 'drizzle-orm';", "import { eq, and, asc, sql, inArray } from 'drizzle-orm';");
code = code.replace(
`    const placeholders = activeOrderIds.map(() => '?').join(', ');
    activeOrderItems = await tx.all(
      sql.raw(\`SELECT * FROM order_items WHERE order_id IN (\${placeholders})\`),
      activeOrderIds
    );`,
`    activeOrderItems = await tx.select().from(orderItems).where(inArray(orderItems.orderId, activeOrderIds));`
);

fs.writeFileSync('src/db/queries.ts', code);
