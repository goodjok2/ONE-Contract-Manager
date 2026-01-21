CREATE TABLE "child_llcs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"legal_name" text NOT NULL,
	"formation_state" text DEFAULT 'Delaware',
	"entity_type" text DEFAULT 'LLC',
	"ein" text,
	"formation_date" text,
	"registered_agent" text,
	"registered_agent_address" text,
	"address" text,
	"city" text,
	"state" text,
	"zip" text,
	"insurance_status" text DEFAULT 'Pending' NOT NULL,
	"insurance_expiration" text,
	"annual_report_due" text
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"legal_name" text NOT NULL,
	"entity_type" text,
	"formation_state" text,
	"address" text,
	"city" text,
	"state" text,
	"zip" text,
	"email" text,
	"phone" text,
	"trust_date" text,
	"trustee_name" text,
	"client2_legal_name" text,
	"client2_entity_type" text,
	"ownership_split" text
);
--> statement-breakpoint
CREATE TABLE "contractors" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"contractor_type" text NOT NULL,
	"legal_name" text NOT NULL,
	"state" text,
	"entity_type" text,
	"address" text,
	"city" text,
	"state_address" text,
	"zip" text,
	"license_number" text,
	"license_state" text,
	"license_expiration" text,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"bond_amount" integer,
	"insurance_amount" integer,
	"insurance_expiration" text,
	"insurance_carrier" text,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"contract_type" text NOT NULL,
	"version" integer DEFAULT 1,
	"status" text DEFAULT 'Draft',
	"generated_at" timestamp DEFAULT now(),
	"generated_by" text,
	"template_version" text,
	"file_path" text,
	"file_name" text,
	"file_hash" text,
	"variables_snapshot" text,
	"sent_at" timestamp,
	"sent_to" text,
	"executed_at" timestamp,
	"executed_file_path" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "erp_field_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"variable_name" text NOT NULL,
	"variable_description" text,
	"variable_category" text,
	"odoo_model" text,
	"odoo_field" text,
	"odoo_related_field" text,
	"transform_function" text,
	"default_value" text,
	"is_required" boolean DEFAULT false,
	"validation_regex" text,
	"is_active" boolean DEFAULT true,
	"last_synced_at" timestamp,
	CONSTRAINT "erp_field_mappings_variable_name_unique" UNIQUE("variable_name")
);
--> statement-breakpoint
CREATE TABLE "financials" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"design_fee" integer,
	"design_revision_rounds" integer DEFAULT 3,
	"design_revision_cost_overage" integer,
	"prelim_offsite" integer,
	"prelim_onsite" integer,
	"prelim_contract_price" integer,
	"home_base_price" integer,
	"home_customizations" integer DEFAULT 0,
	"final_offsite" integer,
	"refined_onsite" integer,
	"final_contract_price" integer,
	"is_locked" boolean DEFAULT false,
	"locked_at" timestamp,
	"locked_by" text,
	"inflation_trigger_date" text,
	"inflation_adjustment_percent" real DEFAULT 5,
	"material_increase_threshold" real DEFAULT 10,
	"liquidated_damages_per_day" integer,
	"liquidated_damages_cap" integer,
	"onsite_liquidated_damages_per_day" integer,
	"onsite_liquidated_damages_cap" integer
);
--> statement-breakpoint
CREATE TABLE "llcs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"project_name" text NOT NULL,
	"status" text DEFAULT 'pending',
	"state_of_formation" text DEFAULT 'Delaware',
	"ein_number" text,
	"registered_agent" text,
	"formation_date" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"milestone_type" text NOT NULL,
	"milestone_number" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"percentage" real,
	"amount" integer,
	"due_upon" text,
	"target_date" text,
	"completed_date" text,
	"status" text DEFAULT 'Pending',
	"paid_date" text,
	"paid_amount" integer,
	"invoice_number" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "project_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"delivery_address" text,
	"delivery_city" text,
	"delivery_state" text,
	"delivery_zip" text,
	"delivery_county" text,
	"delivery_apn" text,
	"site_acreage" text,
	"site_zoning" text,
	"home_model" text,
	"home_sq_ft" integer,
	"home_bedrooms" integer,
	"home_bathrooms" real,
	"home_stories" integer,
	"home_garage" text,
	"total_units" integer DEFAULT 1,
	"module_count" integer,
	"building_code_reference" text,
	"climate_zone" text,
	"wind_speed" text,
	"snow_load" text,
	"seismic_zone" text,
	"agreement_execution_date" text,
	"design_start_date" text,
	"design_complete_date" text,
	"green_light_date" text,
	"production_start_date" text,
	"estimated_delivery_date" text,
	"actual_delivery_date" text,
	"governing_law_state" text,
	"arbitration_location" text
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_number" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"state" text,
	"on_site_selection" text DEFAULT 'CRC',
	"odoo_project_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "projects_project_number_unique" UNIQUE("project_number")
);
--> statement-breakpoint
CREATE TABLE "warranty_terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"dvele_fit_finish_months" integer DEFAULT 12,
	"dvele_structural_months" integer DEFAULT 120,
	"dvele_systems_months" integer DEFAULT 24,
	"dvele_building_envelope_months" integer DEFAULT 60,
	"onsite_fit_finish_months" integer DEFAULT 12,
	"onsite_structural_months" integer DEFAULT 120,
	"onsite_systems_months" integer DEFAULT 24,
	"client_fit_finish_months" integer DEFAULT 12,
	"client_structural_months" integer DEFAULT 120,
	"client_building_envelope_months" integer DEFAULT 60,
	"custom_warranty_terms" text,
	"warranty_start_date" text
);
--> statement-breakpoint
ALTER TABLE "child_llcs" ADD CONSTRAINT "child_llcs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractors" ADD CONSTRAINT "contractors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financials" ADD CONSTRAINT "financials_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_details" ADD CONSTRAINT "project_details_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_terms" ADD CONSTRAINT "warranty_terms_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;