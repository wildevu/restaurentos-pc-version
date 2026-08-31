const fs = require('fs');
let code = fs.readFileSync('src/db/schema.ts', 'utf8');
code = code.replace(
`export const menuCategories = sqliteTable('menu_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  displayOrder: integer('display_order').notNull().default(0),
});`,
`export const menuCategories = sqliteTable('menu_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  archivedAt: integer('archived_at', { mode: 'timestamp' }),
});`
);
fs.writeFileSync('src/db/schema.ts', code);
