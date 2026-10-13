CREATE TABLE `vdvk_mfp_baseline` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vdvk_code` text,
	`vdvk_name_snapshot` text NOT NULL,
	`mandal_snapshot` text,
	`dealing_products` text,
	`cc_name` text,
	`cc_mobile` text,
	`collected_raw` text,
	`collected_qty` real,
	`processed_raw` text,
	`processed_qty` real,
	`revenue` real,
	`profit` real,
	`parse_status` text DEFAULT 'unparsed' NOT NULL,
	`source_file` text,
	`source_row` integer,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`vdvk_code`) REFERENCES `vdvks`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_mfp_baseline_vdvk` ON `vdvk_mfp_baseline` (`vdvk_code`);--> statement-breakpoint
CREATE INDEX `idx_mfp_baseline_mandal` ON `vdvk_mfp_baseline` (`mandal_snapshot`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_mfp_baseline_source` ON `vdvk_mfp_baseline` (`source_file`,`source_row`);