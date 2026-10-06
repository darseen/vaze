ALTER TABLE `settings` ADD `max_upload_size` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `default_presign_ttl` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `max_presign_ttl` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `hosting_cache_max_age` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `activity_retention_days` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `api_request_retention_days` integer;