import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';

export const tables = sqliteTable('tables', {
  id: text('id').primaryKey(),
  number: integer('number').notNull(),
  label: text('label'),
  section: text('section').default('Main Dining'),
  displayOrder: integer('display_order').default(0),
  status: text('status').notNull().default('EMPTY'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  archivedAt: integer('archived_at', { mode: 'timestamp' }),
});

export const menuCategories = sqliteTable('menu_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  archivedAt: integer('archived_at', { mode: 'timestamp' }),
});

export const menuItems = sqliteTable('menu_items', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').references(() => menuCategories.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  price: real('price').notNull(),
  isAvailable: integer('is_available', { mode: 'boolean' }).notNull().default(true),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  archivedAt: integer('archived_at', { mode: 'timestamp' }),
});

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  tableId: text('table_id').references(() => tables.id).notNull(),
  status: text('status').notNull().default('OPEN'),
  currencySnapshot: text('currency_snapshot').default('USD'),
  openedByUserId: text('opened_by_user_id').references(() => users.id),
  closedByUserId: text('closed_by_user_id').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  archivedAt: integer('archived_at', { mode: 'timestamp' }),
});

export const orderItems = sqliteTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').references(() => orders.id).notNull(),
  menuItemId: text('menu_item_id').references(() => menuItems.id).notNull(),
  productNameSnapshot: text('product_name_snapshot').notNull(),
  unitPriceSnapshot: real('unit_price_snapshot').notNull(),
  quantity: integer('quantity').notNull().default(1),
  addedByUserId: text('added_by_user_id').references(() => users.id),
  notes: text('notes'),
  kitchenStatus: text('kitchen_status', { enum: ['PENDING', 'PREPARING', 'READY', 'SERVED'] }).notNull().default('PENDING'),
  kitchenStatusUpdatedAt: integer('kitchen_status_updated_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  archivedAt: integer('archived_at', { mode: 'timestamp' }),
});

export const restaurants = sqliteTable('restaurants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  language: text('language').notNull().default('en'),
  currency: text('currency').notNull().default('USD'),
  timezone: text('timezone').notNull().default('UTC'),
  logo: text('logo'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  archivedAt: integer('archived_at', { mode: 'timestamp' }),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  restaurantId: text('restaurant_id').references(() => restaurants.id).notNull(),
  name: text('name').notNull(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['OWNER', 'MANAGER', 'WAITER', 'KITCHEN', 'CASHIER'] }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  archivedAt: integer('archived_at', { mode: 'timestamp' }),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  disabledAt: integer('disabled_at', { mode: 'timestamp' }),
  disabledByUserId: text('disabled_by_user_id'),
});

export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  restaurantId: text('restaurant_id').references(() => restaurants.id).notNull(),
  deviceIdentifier: text('device_identifier').notNull(),
  name: text('name'),
  type: text('type'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull(),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  revokedByUserId: text('revoked_by_user_id'),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  deviceId: text('device_id').references(() => devices.id),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull(),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  revokedReason: text('revoked_reason'),
});

export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  restaurantId: text('restaurant_id').references(() => restaurants.id),
  actorUserId: text('actor_user_id').references(() => users.id),
  actorDeviceId: text('actor_device_id').references(() => devices.id),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  metadata: text('metadata'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const idempotencyKeys = sqliteTable('idempotency_keys', {
  id: text('id').notNull(),
  restaurantId: text('restaurant_id').notNull(),
  actorUserId: text('actor_user_id').notNull(),
  operation: text('operation').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  stateVersion: integer('state_version'),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.restaurantId, table.id] })
  };
});

export const hubState = sqliteTable('hub_state', {
  restaurantId: text('restaurant_id').primaryKey(),
  version: integer('version').notNull().default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const pairingTokens = sqliteTable('pairing_tokens', {
  id: text('id').primaryKey(),
  restaurantId: text('restaurant_id').references(() => restaurants.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  invalidatedAt: integer('invalidated_at', { mode: 'timestamp' }),
});

export const installations = sqliteTable('installations', {
  id: text('id').primaryKey(),
  restaurantId: text('restaurant_id').references(() => restaurants.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  lastSeenTime: integer('last_seen_time', { mode: 'timestamp' }).notNull(),
});

export const licenses = sqliteTable('licenses', {
  id: text('id').primaryKey(),
  rawLicenseKey: text('raw_license_key').notNull(),
  product: text('product').notNull(),
  version: integer('version').notNull(),
  licenseType: text('license_type').notNull().default('STANDARD'),
  restaurantId: text('restaurant_id').notNull(),
  installationId: text('installation_id').notNull(),
  durationDays: integer('duration_days').notNull(),
  issuedAt: integer('issued_at', { mode: 'timestamp' }).notNull(),
  activatedAt: integer('activated_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  status: text('status', { enum: ['ACTIVE', 'EXPIRED', 'SUPERSEDED', 'REVOKED'] }).notNull().default('ACTIVE'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
