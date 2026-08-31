# 1. Update Terminology (deviceId -> clientInstallationId)
sed -i 's/deviceId/clientInstallationId/g' src/schemas.ts
sed -i 's/deviceId/clientInstallationId/g' src/components/LoginScreen.tsx
sed -i 's/restaurantos_device_id/restaurantos_client_installation_id/g' src/components/LoginScreen.tsx
sed -i 's/deviceIdentifier/clientInstallationId/g' src/db/schema.ts
sed -i 's/deviceId/clientInstallationId/g' src/auth.routes.ts
sed -i 's/actorDeviceId/actorClientInstallationId/g' src/db/schema.ts
sed -i 's/actorDeviceId/actorClientInstallationId/g' src/auth.routes.ts

# 2. Add new columns to src/db/schema.ts using awk
awk '
/export const menuItems = sqliteTable/ {
  print; print "  archivedAt: integer(\"archived_at\", { mode: \"timestamp\" }),"; next
}
/export const orders = sqliteTable/ {
  print; print "  openedByUserId: text(\"opened_by_user_id\").references(() => users.id),"; print "  closedByUserId: text(\"closed_by_user_id\").references(() => users.id),"; next
}
/export const orderItems = sqliteTable/ {
  print; print "  addedByUserId: text(\"added_by_user_id\").references(() => users.id),"; print "  notes: text(\"notes\"),"; next
}
{ print }
' src/db/schema.ts > temp.ts && mv temp.ts src/db/schema.ts

# 3. Append idempotencyKeys
cat << 'EOF2' >> src/db/schema.ts

export const idempotencyKeys = sqliteTable('idempotency_keys', {
  id: text('id').primaryKey(),
  restaurantId: text('restaurant_id').notNull(),
  actorUserId: text('actor_user_id').notNull(),
  operation: text('operation').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
EOF2

# 4. Append CommandPayloadSchema to schemas.ts
cat << 'EOF2' >> src/schemas.ts

export const CommandPayloadSchema = z.object({
  actionId: z.string().uuid(),
  type: z.enum([
    'OPEN_TABLE',
    'CLOSE_TABLE',
    'ADD_ITEM',
    'INCREMENT_ITEM',
    'DECREMENT_ITEM',
    'REMOVE_ITEM',
    'SET_ITEM_NOTE'
  ]),
  payload: z.any()
});

export const OpenTablePayload = z.object({ tableId: z.string() });
export const CloseTablePayload = z.object({ tableId: z.string() });
export const AddItemPayload = z.object({ tableId: z.string(), menuItemId: z.string() });
export const UpdateItemPayload = z.object({ tableId: z.string(), orderItemId: z.string() });
export const NoteItemPayload = z.object({ tableId: z.string(), orderItemId: z.string(), notes: z.string().max(255) });
EOF2
bash apply_domain.sh