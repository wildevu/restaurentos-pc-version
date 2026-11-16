ALTER TABLE \`orders\` ADD \`closed_at\` integer;
--> statement-breakpoint
ALTER TABLE \`order_items\` ADD \`unit_cost_snapshot\` real;
--> statement-breakpoint
ALTER TABLE \`order_items\` ADD \`ready_at\` integer;
--> statement-breakpoint
CREATE TABLE \`menu_item_cost_history\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`menu_item_id\` text NOT NULL REFERENCES \`menu_items\`(\`id\`) ON DELETE CASCADE,
  \`unit_cost\` real,
  \`effective_from\` integer NOT NULL,
  \`effective_to\` integer,
  \`changed_by_user_id\` text REFERENCES \`users\`(\`id\`),
  \`source\` text DEFAULT 'OWNER' NOT NULL,
  \`created_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX \`menu_item_cost_history_item_effective_idx\`
ON \`menu_item_cost_history\` (\`menu_item_id\`, \`effective_from\`);
--> statement-breakpoint
CREATE INDEX \`menu_item_cost_history_open_revision_idx\`
ON \`menu_item_cost_history\` (\`menu_item_id\`, \`effective_to\`);
--> statement-breakpoint
INSERT INTO \`menu_item_cost_history\`
  (\`id\`, \`menu_item_id\`, \`unit_cost\`, \`effective_from\`, \`effective_to\`, \`changed_by_user_id\`, \`source\`, \`created_at\`)
SELECT
  'legacy-baseline-' || \`id\`,
  \`id\`,
  \`cost_price\`,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  NULL,
  NULL,
  'BASELINE',
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM \`menu_items\`
WHERE \`cost_price\` IS NOT NULL;
