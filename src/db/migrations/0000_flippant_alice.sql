CREATE TABLE `menu_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` real NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `menu_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`menu_item_id` text NOT NULL,
	`product_name_snapshot` text NOT NULL,
	`unit_price_snapshot` real NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`table_id` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tables` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`label` text,
	`status` text DEFAULT 'EMPTY' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
