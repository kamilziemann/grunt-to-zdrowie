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