CREATE TABLE `analysis_report` (
	`id` text PRIMARY KEY NOT NULL,
	`field_id` text NOT NULL,
	`crop_id` text NOT NULL,
	`analysis_date` text NOT NULL,
	`engine_version` text NOT NULL,
	`report` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analysis_report_field_idx` ON `analysis_report` (`field_id`,`analysis_date`);