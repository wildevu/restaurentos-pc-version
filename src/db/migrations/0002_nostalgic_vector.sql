ALTER TABLE `menu_items` ADD `archived_at` integer;
--> statement-breakpoint
ALTER TABLE `order_items` ADD `added_by_user_id` text REFERENCES users(id);
--> statement-breakpoint
ALTER TABLE `order_items` ADD `notes` text;
--> statement-breakpoint
ALTER TABLE `order_items` ADD `archived_at` integer;
--> statement-breakpoint
ALTER TABLE `orders` ADD `opened_by_user_id` text REFERENCES users(id);
--> statement-breakpoint
ALTER TABLE `orders` ADD `closed_by_user_id` text REFERENCES users(id);
--> statement-breakpoint
ALTER TABLE `orders` ADD `archived_at` integer;
--> statement-breakpoint
ALTER TABLE `restaurants` ADD `archived_at` integer;
--> statement-breakpoint
ALTER TABLE `tables` ADD `archived_at` integer;
--> statement-breakpoint
ALTER TABLE `users` ADD `archived_at` integer;
