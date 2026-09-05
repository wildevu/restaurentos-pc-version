CREATE TABLE `installations` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text REFERENCES `restaurants`(`id`),
	`created_at` integer NOT NULL,
	`last_seen_time` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `licenses` (
	`id` text PRIMARY KEY NOT NULL,
	`raw_license_key` text NOT NULL,
	`product` text NOT NULL,
	`version` integer NOT NULL,
	`restaurant_id` text NOT NULL,
	`installation_id` text NOT NULL,
	`duration_days` integer NOT NULL,
	`issued_at` integer NOT NULL,
	`activated_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_licenses_installation_id` ON `licenses` (`installation_id`);
--> statement-breakpoint
CREATE INDEX `idx_licenses_status` ON `licenses` (`status`);
