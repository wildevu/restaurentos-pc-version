ALTER TABLE `order_items` ADD `kitchen_status` text DEFAULT 'PENDING' NOT NULL;
--> statement-breakpoint
ALTER TABLE `order_items` ADD `kitchen_status_updated_at` integer;
