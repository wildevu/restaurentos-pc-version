ALTER TABLE `restaurants` ADD `seating_capacity` integer DEFAULT 30 NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD `covers` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `menu_items` ADD `cost_price` real;
--> statement-breakpoint
ALTER TABLE `licenses` ADD `license_type` text DEFAULT 'STANDARD' NOT NULL;
