-- Production indexes for high-throughput restaurant operations
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_kitchen_status ON order_items(kitchen_status);

CREATE INDEX IF NOT EXISTS idx_audit_events_restaurant_id ON audit_events(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);

CREATE INDEX IF NOT EXISTS idx_devices_restaurant_id ON devices(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_devices_identifier ON devices(device_identifier);

CREATE INDEX IF NOT EXISTS idx_pairing_tokens_token_hash ON pairing_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_pairing_tokens_user_id ON pairing_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_available ON menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_tables_section ON tables(section);
