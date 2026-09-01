CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`seller_id` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`sector` text NOT NULL,
	`country` text NOT NULL,
	`jurisdiction` text DEFAULT '' NOT NULL,
	`license_type` text DEFAULT '' NOT NULL,
	`business_status` text DEFAULT 'ACTIVE' NOT NULL,
	`deal_type` text DEFAULT 'FULL_SALE' NOT NULL,
	`stake_offered` integer DEFAULT 100 NOT NULL,
	`asking_price_cents` integer DEFAULT 0 NOT NULL,
	`revenue_cents` integer DEFAULT 0 NOT NULL,
	`ebitda_cents` integer DEFAULT 0 NOT NULL,
	`employees` integer DEFAULT 0 NOT NULL,
	`founded_year` integer,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`status_reason` text,
	`views` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_reference_idx` ON `assets` (`reference`);--> statement-breakpoint
CREATE INDEX `assets_status_idx` ON `assets` (`status`,`sector`);--> statement-breakpoint
CREATE INDEX `assets_seller_idx` ON `assets` (`seller_id`);--> statement-breakpoint
CREATE TABLE `buyer_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`headline` text DEFAULT '' NOT NULL,
	`about` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`investor_type` text DEFAULT 'STRATEGIC' NOT NULL,
	`ticket_min_cents` integer DEFAULT 0 NOT NULL,
	`ticket_max_cents` integer DEFAULT 0 NOT NULL,
	`sectors` text DEFAULT '[]' NOT NULL,
	`jurisdictions` text DEFAULT '[]' NOT NULL,
	`deal_types` text DEFAULT '[]' NOT NULL,
	`timeline` text DEFAULT 'EXPLORING' NOT NULL,
	`proof_of_funds` integer DEFAULT false NOT NULL,
	`listed_in_directory` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `buyer_directory_idx` ON `buyer_profiles` (`listed_in_directory`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text,
	`buyer_id` text NOT NULL,
	`seller_id` text NOT NULL,
	`started_by` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`last_message_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversations_pair_idx` ON `conversations` (`buyer_id`,`seller_id`,`asset_id`);--> statement-breakpoint
CREATE INDEX `conversations_buyer_idx` ON `conversations` (`buyer_id`,`last_message_at`);--> statement-breakpoint
CREATE INDEX `conversations_seller_idx` ON `conversations` (`seller_id`,`last_message_at`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`read_at` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_conversation_idx` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `moderation_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`target_label` text NOT NULL,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `moderation_created_idx` ON `moderation_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `saved_assets` (
	`buyer_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	PRIMARY KEY(`buyer_id`, `asset_id`),
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `seller_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`company` text NOT NULL,
	`country` text NOT NULL,
	`website` text,
	`about` text DEFAULT '' NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`deals_closed` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`status_reason` text,
	`status_changed_at` text,
	`locale` text DEFAULT 'en' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`,`status`);