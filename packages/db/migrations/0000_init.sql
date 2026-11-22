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
CREATE INDEX `analysis_report_field_idx` ON `analysis_report` (`field_id`,`analysis_date`);--> statement-breakpoint
CREATE TABLE `parcel_record` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`region` text NOT NULL,
	`commune` text NOT NULL,
	`county` text NOT NULL,
	`voivodeship` text NOT NULL,
	`geometry` text NOT NULL,
	`origin` text NOT NULL,
	`land_use` text,
	`registry_area_ha` real,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `parcel_record_fetched_idx` ON `parcel_record` (`fetched_at`);