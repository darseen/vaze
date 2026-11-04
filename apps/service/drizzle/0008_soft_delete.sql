DROP INDEX `files_key_unique`;--> statement-breakpoint
DROP INDEX `files_folder_id_name_unique`;--> statement-breakpoint
ALTER TABLE `files` ADD `deleted_at` text;--> statement-breakpoint
CREATE INDEX `files_deleted_at_idx` ON `files` (`deleted_at`) WHERE "files"."deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `files_key_unique` ON `files` (`key`) WHERE "files"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `files_folder_id_name_unique` ON `files` (`folder_id`,`name`) WHERE "files"."deleted_at" IS NULL;--> statement-breakpoint
DROP INDEX `folders_key_unique`;--> statement-breakpoint
ALTER TABLE `folders` ADD `deleted_at` text;--> statement-breakpoint
CREATE INDEX `folders_deleted_at_idx` ON `folders` (`deleted_at`) WHERE "folders"."deleted_at" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `folders_key_unique` ON `folders` (`key`) WHERE "folders"."deleted_at" IS NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `deleted_retention_days` integer;