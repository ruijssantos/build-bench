CREATE TABLE "airbrush" (
	"id" serial PRIMARY KEY NOT NULL,
	"model" text,
	"nozzle_mm" real,
	"cup_cc" real,
	"is_active" boolean DEFAULT true,
	"acquired_at" date
);
--> statement-breakpoint
CREATE TABLE "build_log_entry" (
	"id" serial PRIMARY KEY NOT NULL,
	"kit_id" integer NOT NULL,
	"stage" text,
	"title" text,
	"body_md" text,
	"occurred_on" date,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "build_photo" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"blob_url" text NOT NULL,
	"caption" text,
	"sort" integer
);
--> statement-breakpoint
CREATE TABLE "inventory_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"paint_code" text NOT NULL,
	"form" text,
	"decanted_from" text,
	"state" text,
	"quantity" integer,
	"location" text,
	"purchased_from" integer,
	"purchased_at" date,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kit" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand" text,
	"kit_number" text,
	"name" text,
	"scale" text,
	"status" text,
	"purchased_from" integer,
	"purchased_price" numeric,
	"currency" text,
	"purchased_at" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kit_manual" (
	"id" serial PRIMARY KEY NOT NULL,
	"kit_id" integer NOT NULL,
	"blob_url" text NOT NULL,
	"filename" text,
	"size_bytes" integer,
	"page_count" integer,
	"paints_extracted_at" timestamp with time zone,
	"uploaded_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kit_paint_requirement" (
	"id" serial PRIMARY KEY NOT NULL,
	"kit_id" integer NOT NULL,
	"manual_id" integer,
	"raw_label" text,
	"paint_code" text,
	"part_hint" text,
	"source" text,
	"confidence" real
);
--> statement-breakpoint
CREATE TABLE "kit_research" (
	"id" serial PRIMARY KEY NOT NULL,
	"kit_id" integer,
	"job_id" uuid NOT NULL,
	"resolved_brand" text,
	"resolved_number" text,
	"resolved_name" text,
	"manual_url" text,
	"difficulty" text,
	"difficulty_note" text,
	"fit_issues" jsonb,
	"build_video_url" text,
	"sources" jsonb,
	"model_used" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"verified_by_me" boolean DEFAULT false,
	"researched_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "maintenance_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"airbrush_id" integer NOT NULL,
	"type" text,
	"performed_on" date,
	"notes" text,
	"parts_used" text
);
--> statement-breakpoint
CREATE TABLE "paint" (
	"code" text PRIMARY KEY NOT NULL,
	"line" text,
	"name" text,
	"hex" text,
	"family" text,
	"finish" text,
	"size_ml" integer,
	"discontinued" boolean DEFAULT false,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "paint_brand" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"sort" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paint_equivalent" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand" text NOT NULL,
	"foreign_code" text NOT NULL,
	"foreign_name" text,
	"tamiya_code" text NOT NULL,
	"match_quality" text,
	"source" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "ratio_override" (
	"id" serial PRIMARY KEY NOT NULL,
	"paint_code" text,
	"family" text,
	"paint_parts" real,
	"thinner_parts" real,
	"psi_text" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ratio_rule" (
	"family" text PRIMARY KEY NOT NULL,
	"thinner_type" text,
	"paint_parts" real,
	"thinner_parts" real,
	"window_lo" real,
	"window_hi" real,
	"psi_text" text,
	"coats_text" text,
	"distance_text" text,
	"notes" jsonb
);
--> statement-breakpoint
CREATE TABLE "research_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kit_id" integer,
	"query" text,
	"stage" text,
	"stage_status" jsonb,
	"partial" jsonb,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shopping_list_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"paint_code" text NOT NULL,
	"kit_id" integer,
	"reason" text,
	"substitute_for" text,
	"status" text,
	"vendor_id" integer,
	"added_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "spray_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"kit_id" integer,
	"paint_code" text NOT NULL,
	"ratio_paint" real,
	"ratio_thinner" real,
	"thinner_type" text,
	"psi" real,
	"coats" integer,
	"ambient_temp" real,
	"humidity" real,
	"outcome" integer,
	"notes" text,
	"sprayed_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vendor" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country" text,
	"url" text,
	"notes" text,
	"sort" integer
);
--> statement-breakpoint
ALTER TABLE "build_log_entry" ADD CONSTRAINT "build_log_entry_kit_id_kit_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_photo" ADD CONSTRAINT "build_photo_entry_id_build_log_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."build_log_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_paint_code_paint_code_fk" FOREIGN KEY ("paint_code") REFERENCES "public"."paint"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_decanted_from_paint_code_fk" FOREIGN KEY ("decanted_from") REFERENCES "public"."paint"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_purchased_from_vendor_id_fk" FOREIGN KEY ("purchased_from") REFERENCES "public"."vendor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit" ADD CONSTRAINT "kit_purchased_from_vendor_id_fk" FOREIGN KEY ("purchased_from") REFERENCES "public"."vendor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_manual" ADD CONSTRAINT "kit_manual_kit_id_kit_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_paint_requirement" ADD CONSTRAINT "kit_paint_requirement_kit_id_kit_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_paint_requirement" ADD CONSTRAINT "kit_paint_requirement_manual_id_kit_manual_id_fk" FOREIGN KEY ("manual_id") REFERENCES "public"."kit_manual"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_paint_requirement" ADD CONSTRAINT "kit_paint_requirement_paint_code_paint_code_fk" FOREIGN KEY ("paint_code") REFERENCES "public"."paint"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_research" ADD CONSTRAINT "kit_research_kit_id_kit_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kit_research" ADD CONSTRAINT "kit_research_job_id_research_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."research_job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_log" ADD CONSTRAINT "maintenance_log_airbrush_id_airbrush_id_fk" FOREIGN KEY ("airbrush_id") REFERENCES "public"."airbrush"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paint" ADD CONSTRAINT "paint_family_ratio_rule_family_fk" FOREIGN KEY ("family") REFERENCES "public"."ratio_rule"("family") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paint_equivalent" ADD CONSTRAINT "paint_equivalent_brand_paint_brand_key_fk" FOREIGN KEY ("brand") REFERENCES "public"."paint_brand"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paint_equivalent" ADD CONSTRAINT "paint_equivalent_tamiya_code_paint_code_fk" FOREIGN KEY ("tamiya_code") REFERENCES "public"."paint"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratio_override" ADD CONSTRAINT "ratio_override_paint_code_paint_code_fk" FOREIGN KEY ("paint_code") REFERENCES "public"."paint"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratio_override" ADD CONSTRAINT "ratio_override_family_ratio_rule_family_fk" FOREIGN KEY ("family") REFERENCES "public"."ratio_rule"("family") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_job" ADD CONSTRAINT "research_job_kit_id_kit_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_item" ADD CONSTRAINT "shopping_list_item_paint_code_paint_code_fk" FOREIGN KEY ("paint_code") REFERENCES "public"."paint"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_item" ADD CONSTRAINT "shopping_list_item_kit_id_kit_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_item" ADD CONSTRAINT "shopping_list_item_vendor_id_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spray_session" ADD CONSTRAINT "spray_session_kit_id_kit_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spray_session" ADD CONSTRAINT "spray_session_paint_code_paint_code_fk" FOREIGN KEY ("paint_code") REFERENCES "public"."paint"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paint_equivalent_brand_foreign_code_idx" ON "paint_equivalent" USING btree ("brand","foreign_code");--> statement-breakpoint
CREATE INDEX "paint_equivalent_tamiya_code_idx" ON "paint_equivalent" USING btree ("tamiya_code");