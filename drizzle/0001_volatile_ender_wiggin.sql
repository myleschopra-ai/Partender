CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`category` text DEFAULT 'reference-swing' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'uploading' NOT NULL,
	`multipart_upload_id` text,
	`uploaded_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`uploaded_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_assets_object_key_unique` ON `media_assets` (`object_key`);--> statement-breakpoint
CREATE TABLE `media_upload_parts` (
	`asset_id` text NOT NULL,
	`part_number` integer NOT NULL,
	`etag` text NOT NULL,
	`byte_size` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`asset_id`, `part_number`),
	FOREIGN KEY (`asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE cascade
);
