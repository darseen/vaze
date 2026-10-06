CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`default_visibility` text DEFAULT 'public' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
