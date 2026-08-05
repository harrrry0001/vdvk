CREATE TABLE `districts` (
	`code` text PRIMARY KEY NOT NULL,
	`state_code` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	FOREIGN KEY (`state_code`) REFERENCES `states`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mandals` (
	`code` text PRIMARY KEY NOT NULL,
	`district_code` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	FOREIGN KEY (`district_code`) REFERENCES `districts`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `states` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `villages` (
	`code` text PRIMARY KEY NOT NULL,
	`mandal_code` text NOT NULL,
	`name` text NOT NULL,
	`pin_code` text,
	`status` text DEFAULT 'Active' NOT NULL,
	FOREIGN KEY (`mandal_code`) REFERENCES `mandals`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `commodities` (
	`code` text NOT NULL,
	`name` text NOT NULL,
	`default_unit` text NOT NULL,
	`unit_effective_from` text NOT NULL,
	`unit_effective_to` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `commodity_rates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`commodity_code` text NOT NULL,
	`grade_code` text NOT NULL,
	`unit` text NOT NULL,
	`rate_per_kg` real,
	`rate_per_piece` real,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`commodity_code`) REFERENCES `commodities`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grade_code`) REFERENCES `grades`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `grades` (
	`code` text PRIMARY KEY NOT NULL,
	`commodity_code` text NOT NULL,
	`grade_name` text NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text,
	FOREIGN KEY (`commodity_code`) REFERENCES `commodities`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`mobile` text,
	`address` text,
	`gst_no` text,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `expenditure_heads` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`excluded_from_processing` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `schemes` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact_person` text,
	`mobile` text,
	`email` text,
	`address` text,
	`gst_no` text,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `beneficiaries` (
	`id` text PRIMARY KEY NOT NULL,
	`vdvk_code` text NOT NULL,
	`name` text NOT NULL,
	`age` integer,
	`gender` text,
	`mobile` text,
	`aadhaar` text,
	`address` text,
	`state` text,
	`district` text,
	`mandal` text NOT NULL,
	`village` text,
	`pin_code` text,
	`category` text,
	`registration_mode` text DEFAULT 'Individual' NOT NULL,
	`has_incomplete_details` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`approval_remarks` text,
	`approved_by` text,
	`approved_at` text,
	`created_by` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`vdvk_code`) REFERENCES `vdvks`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `beneficiary_commodities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`beneficiary_id` text NOT NULL,
	`commodity_code` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiaries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vdvk_commodities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vdvk_code` text NOT NULL,
	`commodity_code` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`vdvk_code`) REFERENCES `vdvks`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vdvks` (
	`code` text PRIMARY KEY NOT NULL,
	`scheme_code` text NOT NULL,
	`name` text NOT NULL,
	`state` text NOT NULL,
	`district` text NOT NULL,
	`mandal` text NOT NULL,
	`village` text,
	`pin_code` text,
	`sanction_date` text,
	`beneficiary_count` integer DEFAULT 0 NOT NULL,
	`amount_sanctioned` real,
	`amount_released` real,
	`bank_name` text,
	`account_number` text,
	`ifsc` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`approval_remarks` text,
	`approved_by` text,
	`approved_at` text,
	`created_by` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`scheme_code`) REFERENCES `schemes`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `facilities` (
	`code` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`scheme_code` text,
	`state` text,
	`district` text,
	`mandal` text,
	`village` text,
	`address` text,
	`pin_code` text,
	`date_of_establishment` text,
	`operational_status` text DEFAULT 'Operational' NOT NULL,
	`storage_capacity_kg` real,
	`processing_capacity_kg_per_day` real,
	`electricity_available` integer,
	`water_facility` integer,
	`internet_connectivity` integer,
	`other_infrastructure` text,
	`machinery_available` integer,
	`total_fund_sanctioned` real,
	`total_fund_released` real,
	`total_fund_utilised` real,
	`balance_fund` real,
	`status` text DEFAULT 'Draft' NOT NULL,
	`approval_remarks` text,
	`approved_by` text,
	`approved_at` text,
	`created_by` text NOT NULL,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `facility_commodities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`facility_code` text NOT NULL,
	`commodity_code` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`facility_code`) REFERENCES `facilities`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `facility_supervisors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`facility_code` text NOT NULL,
	`supervisor_user_id` text NOT NULL,
	`supervisor_name_snapshot` text NOT NULL,
	`assigned_from` text NOT NULL,
	`assigned_to` text,
	`remarks` text,
	`created_at` text,
	FOREIGN KEY (`facility_code`) REFERENCES `facilities`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `facility_vdvk_mapping` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`facility_code` text NOT NULL,
	`vdvk_code` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`facility_code`) REFERENCES `facilities`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vdvk_code`) REFERENCES `vdvks`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `machinery` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`commodity_mapping` text,
	`current_facility_code` text,
	`current_vdvk_code` text,
	`installation_location` text,
	`mandal` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_cost` real NOT NULL,
	`total_cost` real NOT NULL,
	`purchase_date` text,
	`supplier_code` text,
	`supplier_name_snapshot` text,
	`supplier_contact_person` text,
	`supplier_mobile` text,
	`supplier_email` text,
	`warranty_available` integer,
	`warranty_type` text,
	`warranty_period` text,
	`warranty_start_date` text,
	`warranty_expiry_date` text,
	`funding_source` text,
	`reason_purpose` text,
	`current_status` text DEFAULT 'Available' NOT NULL,
	`last_service_date` text,
	`next_service_due_date` text,
	`source` text DEFAULT 'Form7' NOT NULL,
	`existing_asset_id` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`approval_remarks` text,
	`approved_by` text,
	`approved_at` text,
	`created_by` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`current_facility_code`) REFERENCES `facilities`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`current_vdvk_code`) REFERENCES `vdvks`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_code`) REFERENCES `suppliers`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `machinery_transfers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`machinery_id` text NOT NULL,
	`transfer_date` text NOT NULL,
	`from_facility_code` text,
	`to_facility_type` text,
	`to_facility_code` text,
	`reason` text,
	`remarks` text,
	`supporting_doc` text,
	`date_received` text,
	`condition_on_arrival` text,
	`completion_remarks` text,
	`completion_photos` text,
	`is_complete` integer DEFAULT false NOT NULL,
	`created_at` text,
	FOREIGN KEY (`machinery_id`) REFERENCES `machinery`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`assigned_from` text NOT NULL,
	`assigned_to` text,
	`created_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`refresh_token` text NOT NULL,
	`active_role` text,
	`expires_at` text NOT NULL,
	`is_revoked` integer DEFAULT false NOT NULL,
	`created_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_transfer_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`changed_field` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`reason` text,
	`changed_by` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`mobile` text,
	`designation` text,
	`mandal` text,
	`vdvk_code` text,
	`facility_code` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`failed_login_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`password_changed_at` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `form1_collection_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`collection_id` text NOT NULL,
	`beneficiary_id` text NOT NULL,
	`beneficiary_name_snapshot` text NOT NULL,
	`commodity_code` text NOT NULL,
	`commodity_name_snapshot` text NOT NULL,
	`grade_code` text,
	`grade_name_snapshot` text,
	`unit` text NOT NULL,
	`unit_snapshot` text NOT NULL,
	`qty_kg` real,
	`qty_pieces` real,
	`rate_per_kg` real,
	`rate_per_piece` real,
	`rate_snapshot` text,
	`total_cost` real,
	`remarks` text,
	`created_at` text,
	FOREIGN KEY (`collection_id`) REFERENCES `form1_collections`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiaries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`commodity_code`) REFERENCES `commodities`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grade_code`) REFERENCES `grades`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `form1_collections` (
	`id` text PRIMARY KEY NOT NULL,
	`txn_no` text NOT NULL,
	`vdvk_code` text NOT NULL,
	`vdvk_name_snapshot` text NOT NULL,
	`collection_date` text NOT NULL,
	`place_of_submission` text NOT NULL,
	`transaction_type` text NOT NULL,
	`overall_remarks` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`approval_remarks` text,
	`approved_by` text,
	`approved_at` text,
	`submitted_at` text,
	`created_by_role_snapshot` text NOT NULL,
	`created_by_mandal_snapshot` text,
	`created_by` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`vdvk_code`) REFERENCES `vdvks`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `form2_stock_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`txn_no` text NOT NULL,
	`transfer_date` text NOT NULL,
	`sent_from_facility_code` text NOT NULL,
	`sent_from_name_snapshot` text NOT NULL,
	`sent_to_facility_code` text NOT NULL,
	`sent_to_name_snapshot` text NOT NULL,
	`sent_by` text,
	`sent_by_name_snapshot` text,
	`vehicle_details` text,
	`driver_name` text,
	`driver_mobile` text,
	`overall_remarks` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`approval_remarks` text,
	`approved_by` text,
	`approved_at` text,
	`submitted_at` text,
	`created_by` text NOT NULL,
	`created_by_role_snapshot` text NOT NULL,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `form2_transfer_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transfer_id` text NOT NULL,
	`vdvk_code` text NOT NULL,
	`vdvk_name_snapshot` text NOT NULL,
	`beneficiary_id` text NOT NULL,
	`beneficiary_name_snapshot` text NOT NULL,
	`commodity_code` text NOT NULL,
	`commodity_name_snapshot` text NOT NULL,
	`grade_code` text,
	`grade_name_snapshot` text,
	`goods_type` text NOT NULL,
	`unit` text NOT NULL,
	`available_kg` real,
	`transfer_qty_kg` real,
	`available_pieces` real,
	`transfer_qty_pieces` real,
	`rate_per_kg` real,
	`rate_per_piece` real,
	`total_value` real,
	`source_stock_ledger_id` integer,
	`created_at` text,
	FOREIGN KEY (`transfer_id`) REFERENCES `form2_stock_transfers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vdvk_code`) REFERENCES `vdvks`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiaries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`commodity_code`) REFERENCES `commodities`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grade_code`) REFERENCES `grades`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `form3_packaging_details` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`processing_item_id` integer NOT NULL,
	`packet_size` text NOT NULL,
	`number_of_packets` integer NOT NULL,
	`total_qty_kg` real,
	`total_qty_pieces` real,
	`created_at` text,
	FOREIGN KEY (`processing_item_id`) REFERENCES `form3_processing_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `form3_processing` (
	`id` text PRIMARY KEY NOT NULL,
	`txn_no` text NOT NULL,
	`processing_location_code` text NOT NULL,
	`processing_location_name_snapshot` text NOT NULL,
	`processing_date` text NOT NULL,
	`overall_remarks` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`approval_remarks` text,
	`approved_by` text,
	`approved_at` text,
	`submitted_at` text,
	`created_by` text NOT NULL,
	`created_by_role_snapshot` text NOT NULL,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `form3_processing_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`processing_id` text NOT NULL,
	`vdvk_code` text NOT NULL,
	`vdvk_name_snapshot` text NOT NULL,
	`beneficiary_id` text,
	`beneficiary_name_snapshot` text,
	`commodity_code` text NOT NULL,
	`commodity_name_snapshot` text NOT NULL,
	`grade_code` text,
	`grade_name_snapshot` text,
	`unit` text NOT NULL,
	`available_stock_kg` real,
	`qty_taken_kg` real,
	`rate_per_kg` real,
	`available_stock_pcs` real,
	`qty_taken_pcs` real,
	`rate_per_piece` real,
	`raw_material_value` real,
	`finished_kg` real,
	`finished_pcs` real,
	`final_cost_per_kg` real,
	`final_cost_per_piece` real,
	`finished_value` real,
	`processing_cost` real,
	`value_addition` real,
	`yield_loss_kg` real,
	`yield_loss_pcs` real,
	`per_unit_processing_cost_kg` real,
	`per_unit_processing_cost_pc` real,
	`remarks` text,
	`source_stock_ledger_ids` text,
	`created_at` text,
	FOREIGN KEY (`processing_id`) REFERENCES `form3_processing`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vdvk_code`) REFERENCES `vdvks`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiaries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`commodity_code`) REFERENCES `commodities`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grade_code`) REFERENCES `grades`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `form4_sales` (
	`id` text PRIMARY KEY NOT NULL,
	`txn_no` text NOT NULL,
	`sale_location_code` text NOT NULL,
	`sale_location_name_snapshot` text NOT NULL,
	`sale_date` text NOT NULL,
	`overall_remarks` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`approval_remarks` text,
	`approved_by` text,
	`approved_at` text,
	`submitted_at` text,
	`created_by` text NOT NULL,
	`created_by_role_snapshot` text NOT NULL,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `form4_sales_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sales_id` text NOT NULL,
	`customer_code` text NOT NULL,
	`customer_name_snapshot` text NOT NULL,
	`customer_mobile_snapshot` text,
	`invoice_no` text NOT NULL,
	`vdvk_code` text NOT NULL,
	`vdvk_name_snapshot` text NOT NULL,
	`beneficiary_id` text,
	`beneficiary_name_snapshot` text,
	`product_type` text NOT NULL,
	`commodity_code` text NOT NULL,
	`commodity_name_snapshot` text NOT NULL,
	`grade_code` text,
	`grade_name_snapshot` text,
	`sales_unit` text NOT NULL,
	`available_kg` real,
	`available_pcs` real,
	`packet_details` text,
	`sold_kg` real,
	`sold_pcs` real,
	`price_per_kg` real,
	`price_per_piece` real,
	`total_sales_value` real,
	`closing_kg` real,
	`closing_pcs` real,
	`remarks` text,
	`source_stock_ledger_ids` text,
	`created_at` text,
	FOREIGN KEY (`sales_id`) REFERENCES `form4_sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_code`) REFERENCES `customers`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vdvk_code`) REFERENCES `vdvks`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiaries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`commodity_code`) REFERENCES `commodities`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grade_code`) REFERENCES `grades`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `form4_sales_packaging` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sales_item_id` integer NOT NULL,
	`packet_size` text NOT NULL,
	`number_of_packets` integer NOT NULL,
	`total_qty` real NOT NULL,
	`created_at` text,
	FOREIGN KEY (`sales_item_id`) REFERENCES `form4_sales_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `form8_utilisation` (
	`id` text PRIMARY KEY NOT NULL,
	`txn_no` text NOT NULL,
	`processing_date` text NOT NULL,
	`overall_remarks` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`verification_remarks` text,
	`verified_by` text,
	`verified_at` text,
	`submitted_at` text,
	`created_by` text NOT NULL,
	`created_by_role_snapshot` text NOT NULL,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `form8_utilisation_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`utilisation_id` text NOT NULL,
	`location_type` text NOT NULL,
	`facility_code` text,
	`facility_name_snapshot` text NOT NULL,
	`vdvk_code` text,
	`vdvk_name_snapshot` text,
	`mandal` text,
	`machinery_id` text NOT NULL,
	`machinery_name_snapshot` text NOT NULL,
	`commodity_code` text NOT NULL,
	`commodity_name_snapshot` text NOT NULL,
	`unit` text NOT NULL,
	`raw_qty_kg` real,
	`raw_qty_pcs` real,
	`packet_details` text,
	`final_output_kg` real,
	`final_output_pcs` real,
	`yield_loss_kg` real,
	`yield_loss_pcs` real,
	`utilisation_hours` real,
	`remarks` text,
	`form3_reference_id` text,
	`tolerance_flagged` integer DEFAULT false NOT NULL,
	`created_at` text,
	FOREIGN KEY (`utilisation_id`) REFERENCES `form8_utilisation`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`facility_code`) REFERENCES `facilities`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`machinery_id`) REFERENCES `machinery`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `form10_expenditure_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`utilisation_id` text NOT NULL,
	`expenditure_date` text NOT NULL,
	`expenditure_head_code` text NOT NULL,
	`expenditure_head_name_snapshot` text NOT NULL,
	`related_to_vdvk` integer NOT NULL,
	`vdvk_codes` text,
	`related_to_location` integer NOT NULL,
	`location_type` text,
	`location_codes` text,
	`amount` real NOT NULL,
	`purpose` text,
	`scheme_snapshot` text,
	`remarks` text,
	`created_at` text,
	FOREIGN KEY (`utilisation_id`) REFERENCES `form10_fund_utilisation`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`expenditure_head_code`) REFERENCES `expenditure_heads`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `form10_fund_utilisation` (
	`id` text PRIMARY KEY NOT NULL,
	`txn_no` text NOT NULL,
	`week_from` text NOT NULL,
	`week_to` text NOT NULL,
	`supporting_documents` text,
	`overall_remarks` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`approval_remarks` text,
	`approved_by` text,
	`approved_at` text,
	`submitted_at` text,
	`created_by` text NOT NULL,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `form12_field_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`txn_no` text NOT NULL,
	`visit_date` text NOT NULL,
	`visit_start_time` text NOT NULL,
	`visit_end_time` text,
	`mandal` text NOT NULL,
	`visit_location_type` text NOT NULL,
	`location_name` text,
	`related_vdvk_codes` text,
	`purpose_of_visit` text,
	`visit_description` text,
	`key_observations` text,
	`gps_latitude` real,
	`gps_longitude` real,
	`photo_count` integer DEFAULT 0 NOT NULL,
	`supporting_documents` text,
	`remarks` text,
	`editable_until` text NOT NULL,
	`created_by` text NOT NULL,
	`created_by_role_snapshot` text NOT NULL,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `form12_visit_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visit_id` text NOT NULL,
	`photo_url` text NOT NULL,
	`gps_latitude` real,
	`gps_longitude` real,
	`captured_at` text,
	`created_at` text,
	FOREIGN KEY (`visit_id`) REFERENCES `form12_field_visits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `form9_training_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`training_id` text NOT NULL,
	`vdvk_code` text NOT NULL,
	`vdvk_name_snapshot` text NOT NULL,
	`scheme_snapshot` text,
	`mandal_snapshot` text,
	`commodity_covered` text,
	`number_of_participants` integer NOT NULL,
	`training_expense` real,
	`remarks` text,
	`created_at` text,
	FOREIGN KEY (`training_id`) REFERENCES `form9_trainings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vdvk_code`) REFERENCES `vdvks`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `form9_trainings` (
	`id` text PRIMARY KEY NOT NULL,
	`txn_no` text NOT NULL,
	`training_date` text NOT NULL,
	`training_title` text NOT NULL,
	`training_topic` text,
	`training_type` text,
	`training_venue` text,
	`resource_person` text,
	`total_participants` integer,
	`total_expenditure` real,
	`supporting_documents` text,
	`overall_remarks` text,
	`is_draft` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `audit_trail` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`form_type` text NOT NULL,
	`action` text NOT NULL,
	`performed_by` text,
	`performer_role_snapshot` text,
	`performed_at` text,
	`old_values` text,
	`new_values` text,
	`remarks` text,
	`escalated` integer DEFAULT false NOT NULL,
	`escalated_to` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `email_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_key` text NOT NULL,
	`subject` text NOT NULL,
	`body_html` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `migration_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity` text NOT NULL,
	`record_count` integer NOT NULL,
	`migrated_by` text NOT NULL,
	`source_file` text,
	`remarks` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `notification_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notification_id` text,
	`channel` text NOT NULL,
	`recipient_email` text,
	`sent_at` text,
	`status` text DEFAULT 'SENT' NOT NULL,
	`error_message` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient_user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`related_transaction_id` text,
	`is_read` integer DEFAULT false NOT NULL,
	`read_at` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `rejected_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`original_transaction_id` text NOT NULL,
	`form_type` text NOT NULL,
	`rejected_data` text NOT NULL,
	`rejected_by` text,
	`rejection_remarks` text,
	`rejected_at` text,
	`resubmitted_as` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `system_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `stock_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vdvk_code` text NOT NULL,
	`vdvk_name_snapshot` text NOT NULL,
	`beneficiary_id` text,
	`beneficiary_name_snapshot` text,
	`commodity_code` text NOT NULL,
	`commodity_name_snapshot` text NOT NULL,
	`grade_code` text,
	`grade_name_snapshot` text,
	`stock_type` text NOT NULL,
	`facility_code` text NOT NULL,
	`facility_name_snapshot` text NOT NULL,
	`unit` text NOT NULL,
	`qty_kg` real DEFAULT 0 NOT NULL,
	`qty_pieces` real DEFAULT 0 NOT NULL,
	`rate_per_kg` real,
	`rate_per_piece` real,
	`total_value` real,
	`source_txn_type` text NOT NULL,
	`source_txn_id` text,
	`parent_lot_id` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`consumed_qty_kg` real DEFAULT 0 NOT NULL,
	`consumed_qty_pieces` real DEFAULT 0 NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`vdvk_code`) REFERENCES `vdvks`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`beneficiary_id`) REFERENCES `beneficiaries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`commodity_code`) REFERENCES `commodities`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grade_code`) REFERENCES `grades`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`facility_code`) REFERENCES `facilities`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stock_movement_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`stock_ledger_id` integer NOT NULL,
	`movement_type` text NOT NULL,
	`qty_kg_change` real DEFAULT 0 NOT NULL,
	`qty_pieces_change` real DEFAULT 0 NOT NULL,
	`resulting_qty_kg` real,
	`resulting_qty_pieces` real,
	`reference_txn_type` text,
	`reference_txn_id` text,
	`performed_by` text,
	`remarks` text,
	`created_at` text,
	FOREIGN KEY (`stock_ledger_id`) REFERENCES `stock_ledger`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_commodities_status` ON `commodities` (`status`);--> statement-breakpoint
CREATE INDEX `idx_commodities_dates` ON `commodities` (`unit_effective_from`,`unit_effective_to`);--> statement-breakpoint
CREATE INDEX `idx_rates_commodity` ON `commodity_rates` (`commodity_code`);--> statement-breakpoint
CREATE INDEX `idx_rates_dates` ON `commodity_rates` (`effective_from`,`effective_to`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_rate_active` ON `commodity_rates` (`commodity_code`,`grade_code`,`effective_from`);--> statement-breakpoint
CREATE INDEX `idx_grades_commodity` ON `grades` (`commodity_code`);--> statement-breakpoint
CREATE INDEX `idx_grades_dates` ON `grades` (`effective_from`,`effective_to`);--> statement-breakpoint
CREATE INDEX `idx_ben_vdvk` ON `beneficiaries` (`vdvk_code`);--> statement-breakpoint
CREATE INDEX `idx_ben_mandal` ON `beneficiaries` (`mandal`);--> statement-breakpoint
CREATE INDEX `idx_ben_status` ON `beneficiaries` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_aadhaar` ON `beneficiaries` (`aadhaar`);--> statement-breakpoint
CREATE INDEX `idx_ben_commodities_ben` ON `beneficiary_commodities` (`beneficiary_id`);--> statement-breakpoint
CREATE INDEX `idx_vdvk_commodities_vdvk` ON `vdvk_commodities` (`vdvk_code`);--> statement-breakpoint
CREATE INDEX `idx_vdvks_scheme` ON `vdvks` (`scheme_code`);--> statement-breakpoint
CREATE INDEX `idx_vdvks_mandal` ON `vdvks` (`mandal`);--> statement-breakpoint
CREATE INDEX `idx_vdvks_status` ON `vdvks` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_vdvk_scheme_mandal` ON `vdvks` (`scheme_code`,`mandal`,`name`);--> statement-breakpoint
CREATE INDEX `idx_facilities_type` ON `facilities` (`type`);--> statement-breakpoint
CREATE INDEX `idx_facilities_mandal` ON `facilities` (`mandal`);--> statement-breakpoint
CREATE INDEX `idx_facilities_status` ON `facilities` (`status`);--> statement-breakpoint
CREATE INDEX `idx_fac_sup_fac` ON `facility_supervisors` (`facility_code`);--> statement-breakpoint
CREATE INDEX `idx_fac_sup_active` ON `facility_supervisors` (`assigned_to`);--> statement-breakpoint
CREATE INDEX `idx_fac_vdvk_fac` ON `facility_vdvk_mapping` (`facility_code`);--> statement-breakpoint
CREATE INDEX `idx_fac_vdvk_vdvk` ON `facility_vdvk_mapping` (`vdvk_code`);--> statement-breakpoint
CREATE INDEX `idx_machinery_facility` ON `machinery` (`current_facility_code`);--> statement-breakpoint
CREATE INDEX `idx_machinery_status` ON `machinery` (`current_status`);--> statement-breakpoint
CREATE INDEX `idx_machinery_approval` ON `machinery` (`status`);--> statement-breakpoint
CREATE INDEX `idx_transfers_machinery` ON `machinery_transfers` (`machinery_id`);--> statement-breakpoint
CREATE INDEX `idx_user_roles_user` ON `user_roles` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_roles_role` ON `user_roles` (`role`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `user_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_token` ON `user_sessions` (`refresh_token`);--> statement-breakpoint
CREATE INDEX `idx_transfer_user` ON `user_transfer_history` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `idx_users_status` ON `users` (`status`);--> statement-breakpoint
CREATE INDEX `idx_users_mandal` ON `users` (`mandal`);--> statement-breakpoint
CREATE INDEX `idx_f1_items_collection` ON `form1_collection_items` (`collection_id`);--> statement-breakpoint
CREATE INDEX `idx_f1_items_beneficiary` ON `form1_collection_items` (`beneficiary_id`);--> statement-breakpoint
CREATE INDEX `idx_f1_items_commodity` ON `form1_collection_items` (`commodity_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `form1_collections_txn_no_unique` ON `form1_collections` (`txn_no`);--> statement-breakpoint
CREATE INDEX `idx_f1_collections_vdvk` ON `form1_collections` (`vdvk_code`);--> statement-breakpoint
CREATE INDEX `idx_f1_collections_date` ON `form1_collections` (`collection_date`);--> statement-breakpoint
CREATE INDEX `idx_f1_collections_status` ON `form1_collections` (`status`);--> statement-breakpoint
CREATE INDEX `idx_f1_collections_approved` ON `form1_collections` (`approved_by`,`approved_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `form2_stock_transfers_txn_no_unique` ON `form2_stock_transfers` (`txn_no`);--> statement-breakpoint
CREATE INDEX `idx_f2_transfers_date` ON `form2_stock_transfers` (`transfer_date`);--> statement-breakpoint
CREATE INDEX `idx_f2_transfers_status` ON `form2_stock_transfers` (`status`);--> statement-breakpoint
CREATE INDEX `idx_f2_transfers_from` ON `form2_stock_transfers` (`sent_from_facility_code`);--> statement-breakpoint
CREATE INDEX `idx_f2_transfers_to` ON `form2_stock_transfers` (`sent_to_facility_code`);--> statement-breakpoint
CREATE INDEX `idx_f2_items_transfer` ON `form2_transfer_items` (`transfer_id`);--> statement-breakpoint
CREATE INDEX `idx_f2_items_vdvk` ON `form2_transfer_items` (`vdvk_code`);--> statement-breakpoint
CREATE INDEX `idx_f3_packaging_item` ON `form3_packaging_details` (`processing_item_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `form3_processing_txn_no_unique` ON `form3_processing` (`txn_no`);--> statement-breakpoint
CREATE INDEX `idx_f3_processing_date` ON `form3_processing` (`processing_date`);--> statement-breakpoint
CREATE INDEX `idx_f3_processing_status` ON `form3_processing` (`status`);--> statement-breakpoint
CREATE INDEX `idx_f3_items_processing` ON `form3_processing_items` (`processing_id`);--> statement-breakpoint
CREATE INDEX `idx_f3_items_commodity` ON `form3_processing_items` (`commodity_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `form4_sales_txn_no_unique` ON `form4_sales` (`txn_no`);--> statement-breakpoint
CREATE INDEX `idx_f4_sales_date` ON `form4_sales` (`sale_date`);--> statement-breakpoint
CREATE INDEX `idx_f4_sales_status` ON `form4_sales` (`status`);--> statement-breakpoint
CREATE INDEX `idx_f4_items_sales` ON `form4_sales_items` (`sales_id`);--> statement-breakpoint
CREATE INDEX `idx_f4_items_customer` ON `form4_sales_items` (`customer_code`);--> statement-breakpoint
CREATE INDEX `idx_f4_items_invoice` ON `form4_sales_items` (`invoice_no`);--> statement-breakpoint
CREATE INDEX `idx_f4_packaging_item` ON `form4_sales_packaging` (`sales_item_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `form8_utilisation_txn_no_unique` ON `form8_utilisation` (`txn_no`);--> statement-breakpoint
CREATE INDEX `idx_f8_utilisation_date` ON `form8_utilisation` (`processing_date`);--> statement-breakpoint
CREATE INDEX `idx_f8_utilisation_status` ON `form8_utilisation` (`status`);--> statement-breakpoint
CREATE INDEX `idx_f8_items_utilisation` ON `form8_utilisation_items` (`utilisation_id`);--> statement-breakpoint
CREATE INDEX `idx_f8_items_machinery` ON `form8_utilisation_items` (`machinery_id`);--> statement-breakpoint
CREATE INDEX `idx_f10_items_utilisation` ON `form10_expenditure_items` (`utilisation_id`);--> statement-breakpoint
CREATE INDEX `idx_f10_items_head` ON `form10_expenditure_items` (`expenditure_head_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `form10_fund_utilisation_txn_no_unique` ON `form10_fund_utilisation` (`txn_no`);--> statement-breakpoint
CREATE INDEX `idx_f10_funds_week` ON `form10_fund_utilisation` (`week_from`,`week_to`);--> statement-breakpoint
CREATE INDEX `idx_f10_funds_status` ON `form10_fund_utilisation` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `form12_field_visits_txn_no_unique` ON `form12_field_visits` (`txn_no`);--> statement-breakpoint
CREATE INDEX `idx_f12_visits_date` ON `form12_field_visits` (`visit_date`);--> statement-breakpoint
CREATE INDEX `idx_f12_visits_mandal` ON `form12_field_visits` (`mandal`);--> statement-breakpoint
CREATE INDEX `idx_f12_visits_created` ON `form12_field_visits` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_f12_photos_visit` ON `form12_visit_photos` (`visit_id`);--> statement-breakpoint
CREATE INDEX `idx_f9_items_training` ON `form9_training_items` (`training_id`);--> statement-breakpoint
CREATE INDEX `idx_f9_items_vdvk` ON `form9_training_items` (`vdvk_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `form9_trainings_txn_no_unique` ON `form9_trainings` (`txn_no`);--> statement-breakpoint
CREATE INDEX `idx_f9_trainings_date` ON `form9_trainings` (`training_date`);--> statement-breakpoint
CREATE INDEX `idx_audit_txn` ON `audit_trail` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_form_type` ON `audit_trail` (`form_type`);--> statement-breakpoint
CREATE INDEX `idx_audit_action` ON `audit_trail` (`action`);--> statement-breakpoint
CREATE INDEX `idx_audit_performed_by` ON `audit_trail` (`performed_by`);--> statement-breakpoint
CREATE INDEX `idx_audit_at` ON `audit_trail` (`performed_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_templates_template_key_unique` ON `email_templates` (`template_key`);--> statement-breakpoint
CREATE INDEX `idx_notif_log_notif` ON `notification_log` (`notification_id`);--> statement-breakpoint
CREATE INDEX `idx_notif_user` ON `notifications` (`recipient_user_id`);--> statement-breakpoint
CREATE INDEX `idx_notif_read` ON `notifications` (`is_read`);--> statement-breakpoint
CREATE INDEX `idx_notif_created` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_rejected_txn` ON `rejected_records` (`original_transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_rejected_form` ON `rejected_records` (`form_type`);--> statement-breakpoint
CREATE INDEX `idx_stock_vdvk` ON `stock_ledger` (`vdvk_code`);--> statement-breakpoint
CREATE INDEX `idx_stock_commodity` ON `stock_ledger` (`commodity_code`);--> statement-breakpoint
CREATE INDEX `idx_stock_facility` ON `stock_ledger` (`facility_code`);--> statement-breakpoint
CREATE INDEX `idx_stock_active` ON `stock_ledger` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_stock_type` ON `stock_ledger` (`stock_type`);--> statement-breakpoint
CREATE INDEX `idx_stock_source` ON `stock_ledger` (`source_txn_type`,`source_txn_id`);--> statement-breakpoint
CREATE INDEX `idx_stock_mvmt_ledger` ON `stock_movement_log` (`stock_ledger_id`);--> statement-breakpoint
CREATE INDEX `idx_stock_mvmt_ref` ON `stock_movement_log` (`reference_txn_type`,`reference_txn_id`);--> statement-breakpoint
CREATE INDEX `idx_stock_mvmt_created` ON `stock_movement_log` (`created_at`);