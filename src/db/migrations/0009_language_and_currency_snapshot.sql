ALTER TABLE `restaurants` ADD `language` text DEFAULT 'en' NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD `currency_snapshot` text DEFAULT 'USD';
