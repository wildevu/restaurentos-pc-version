const fs = require('fs');
let code = fs.readFileSync('src/db/queries.ts', 'utf8');

code = code.replace(
  "import { eq, and, asc, sql, inArray } from 'drizzle-orm';",
  "import { eq, and, asc, sql, inArray, isNull } from 'drizzle-orm';"
);

code = code.replace(
  "const allCategories = await tx.select().from(menuCategories).orderBy(asc(menuCategories.displayOrder));",
  "const allCategories = await tx.select().from(menuCategories).where(isNull(menuCategories.archivedAt)).orderBy(asc(menuCategories.displayOrder));"
);

code = code.replace(
  "const allItems = await tx.select().from(menuItems).where(eq(menuItems.isAvailable, true)).orderBy(asc(menuItems.displayOrder));",
  "const allItems = await tx.select().from(menuItems).where(and(eq(menuItems.isAvailable, true), isNull(menuItems.archivedAt))).orderBy(asc(menuItems.displayOrder));"
);

// We should also allow fetching ALL items in admin route, but `getFrontendStateTx` is for Waiter state.

fs.writeFileSync('src/db/queries.ts', code);
