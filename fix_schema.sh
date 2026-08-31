sed -i 's/updatedAt: integer('\''updated_at'\'', { mode: '\''timestamp'\'' }).notNull(),/updatedAt: integer('\''updated_at'\'', { mode: '\''timestamp'\'' }).notNull(),\n  archivedAt: integer('\''archived_at'\'', { mode: '\''timestamp'\'' }),/g' src/db/schema.ts

sed -i 's/status: text('\''status'\'').notNull().default('\''OPEN'\''),/status: text('\''status'\'').notNull().default('\''OPEN'\''),\n  openedByUserId: text('\''opened_by_user_id'\'').references(() => users.id),\n  closedByUserId: text('\''closed_by_user_id'\'').references(() => users.id),/g' src/db/schema.ts

sed -i 's/quantity: integer('\''quantity'\'').notNull().default(1),/quantity: integer('\''quantity'\'').notNull().default(1),\n  addedByUserId: text('\''added_by_user_id'\'').references(() => users.id),\n  notes: text('\''notes'\''),/g' src/db/schema.ts
