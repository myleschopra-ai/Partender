CREATE TABLE `content_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`pillar` text DEFAULT 'player' NOT NULL,
	`format` text DEFAULT 'Short-form' NOT NULL,
	`channel` text DEFAULT 'Instagram' NOT NULL,
	`status` text DEFAULT 'inbox' NOT NULL,
	`next_action` text DEFAULT 'Write the hook' NOT NULL,
	`priority` integer DEFAULT 3 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
