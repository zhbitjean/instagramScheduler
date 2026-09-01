CREATE TABLE `media_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`schedule_id` integer NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`media_type` text NOT NULL,
	`position` integer NOT NULL,
	`state` text DEFAULT 'queued' NOT NULL,
	`scheduled_for` integer,
	`instagram_media_id` text,
	`error_message` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_media_items_schedule_position` ON `media_items` (`schedule_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_media_items_state_scheduled` ON `media_items` (`state`,`scheduled_for`);--> statement-breakpoint
CREATE TABLE `schedule_times` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`schedule_id` integer NOT NULL,
	`minute_of_day` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_schedule_times_schedule_position` ON `schedule_times` (`schedule_id`,`position`);--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text DEFAULT 'My Instagram schedule' NOT NULL,
	`instagram_account_id` text,
	`instagram_username` text,
	`caption` text DEFAULT '' NOT NULL,
	`interval_days` integer DEFAULT 2 NOT NULL,
	`timezone` text DEFAULT 'America/New_York' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`next_run_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_schedules_status_next_run` ON `schedules` (`status`,`next_run_at`);
--> statement-breakpoint
PRAGMA optimize;
