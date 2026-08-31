const { primaryKey, sqliteTable, text, integer } = require('drizzle-orm/sqlite-core');

const idempotencyKeys = sqliteTable('idempotency_keys', {
  id: text('id').notNull(),
  restaurantId: text('restaurant_id').notNull(),
  actorUserId: text('actor_user_id').notNull(),
  operation: text('operation').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  stateVersion: integer('state_version'),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.restaurantId, table.id] }),
  };
});

const hubState = sqliteTable('hub_state', {
  restaurantId: text('restaurant_id').primaryKey(),
  version: integer('version').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

console.log("Syntax is valid");
