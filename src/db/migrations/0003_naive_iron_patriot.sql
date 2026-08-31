CREATE TABLE `hub_state` (
	`restaurant_id` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`id` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`operation` text NOT NULL,
	`created_at` integer NOT NULL,
	`state_version` integer,
	PRIMARY KEY(`restaurant_id`, `id`)
);
