ALTER TABLE `users` ADD `last_signed_in_at` integer;--> statement-breakpoint
-- accounts that signed in before this start from their newest session
UPDATE `users` SET `last_signed_in_at` = (SELECT max(`created_at`) FROM `sessions` WHERE `sessions`.`user_id` = `users`.`id`);
