DROP INDEX `api_keys_name_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_user_id_name_unique` ON `api_keys` (`user_id`,`name`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `impersonated_by` text;--> statement-breakpoint
ALTER TABLE `users` ADD `role` text DEFAULT 'viewer' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `scopes` text;--> statement-breakpoint
ALTER TABLE `users` ADD `banned` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `ban_expires` integer;--> statement-breakpoint
-- the single account that existed before roles is the admin
UPDATE `users` SET `role` = 'admin';