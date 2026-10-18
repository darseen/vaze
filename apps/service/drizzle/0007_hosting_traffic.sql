CREATE TABLE `hosting_days` (
	`date` text PRIMARY KEY NOT NULL,
	`requests` integer DEFAULT 0 NOT NULL,
	`bytes` integer DEFAULT 0 NOT NULL,
	`not_found` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hosting_file_days` (
	`date` text NOT NULL,
	`file_id` text NOT NULL,
	`requests` integer DEFAULT 0 NOT NULL,
	`bytes` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`date`, `file_id`),
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `hosting_file_days_file_id_idx` ON `hosting_file_days` (`file_id`);