ALTER TABLE `tables` ADD `section` text DEFAULT 'Main Dining';
--> statement-breakpoint
ALTER TABLE `tables` ADD `display_order` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `restaurants` ADD `logo` text;
