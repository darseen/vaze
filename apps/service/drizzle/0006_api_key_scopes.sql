ALTER TABLE `api_keys` ADD `scopes` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- keys made before scopes keep the full file access they had
UPDATE `api_keys` SET `scopes` = 'files:read,files:write,files:delete';