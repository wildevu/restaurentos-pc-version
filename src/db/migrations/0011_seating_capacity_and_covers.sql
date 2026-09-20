ALTER TABLE `restaurants` ADD `seating_capacity` integer DEFAULT 30 NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD `covers` integer DEFAULT 1 NOT NULL;
