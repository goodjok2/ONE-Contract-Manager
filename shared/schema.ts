import { pgTable, text, serial, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// =============================================================================
// CORE TABLES
// =============================================================================

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  projectNumber: text("project_number").unique().notNull(),
  name: text("name").notNull(),
  status: text("status").default("Draft").notNull(), // Draft, Design, GreenLight, Production, Delivered, Complete
  state: text("state"), // Project state (CA, TX, AZ, etc.)
  onSiteSelection: text("on_site_selection").default("CRC"), // CRC or CMOS
  llcId: integer("llc_id"), // Link to LLC - supports one-to-many (one LLC can serve multiple projects)
  odooProjectId: integer("odoo_project_id"), // Link to Odoo
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  
  // Primary Client
  legalName: text("legal_name").notNull(),
  entityType: text("entity_type"), // Individual, LLC, Corporation, Trust
  formationState: text("formation_state"), // State where client entity was formed
  
  // Address
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  
  // Contact
  email: text("email"),
  phone: text("phone"),
  
  // For Trusts
  trustDate: text("trust_date"),
  trusteeName: text("trustee_name"),
  
  // Secondary Client (if applicable)
  client2LegalName: text("client2_legal_name"),
  client2EntityType: text("client2_entity_type"),
  ownershipSplit: text("ownership_split"), // e.g., "50/50", "60/40"
});

export const childLlcs = pgTable("child_llcs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  
  // Entity Info
  legalName: text("legal_name").notNull(), // "Dvele Partners {ProjectName} LLC"
  formationState: text("formation_state").default("Delaware"),
  entityType: text("entity_type").default("LLC"),
  ein: text("ein"),
  formationDate: text("formation_date"),
  
  // Registered Agent
  registeredAgent: text("registered_agent"),
  registeredAgentAddress: text("registered_agent_address"),
  
  // Address (if different from registered agent)
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  
  // Status Tracking
  insuranceStatus: text("insurance_status").default("Pending").notNull(), // Pending, Active, Expired
  insuranceExpiration: text("insurance_expiration"),
  annualReportDue: text("annual_report_due"),
});

// =============================================================================
// PROJECT DETAILS
// =============================================================================

export const projectDetails = pgTable("project_details", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  
  // Site/Delivery Information
  deliveryAddress: text("delivery_address"),
  deliveryCity: text("delivery_city"),
  deliveryState: text("delivery_state"),
  deliveryZip: text("delivery_zip"),
  deliveryCounty: text("delivery_county"),
  deliveryApn: text("delivery_apn"), // Assessor's Parcel Number
  siteAcreage: text("site_acreage"),
  siteZoning: text("site_zoning"),
  
  // Home Specifications
  homeModel: text("home_model"),
  homeSqFt: integer("home_sq_ft"),
  homeBedrooms: integer("home_bedrooms"),
  homeBathrooms: real("home_bathrooms"),
  homeStories: integer("home_stories"),
  homeGarage: text("home_garage"), // "2-car attached", "none", etc.
  totalUnits: integer("total_units").default(1),
  moduleCount: integer("module_count"),
  
  // Building Code & Engineering
  buildingCodeReference: text("building_code_reference"),
  climateZone: text("climate_zone"),
  windSpeed: text("wind_speed"),
  snowLoad: text("snow_load"),
  seismicZone: text("seismic_zone"),
  
  // Key Dates
  agreementExecutionDate: text("agreement_execution_date"),
  designStartDate: text("design_start_date"),
  designCompleteDate: text("design_complete_date"),
  greenLightDate: text("green_light_date"),
  productionStartDate: text("production_start_date"),
  estimatedDeliveryDate: text("estimated_delivery_date"),
  actualDeliveryDate: text("actual_delivery_date"),
  
  // Legal
  governingLawState: text("governing_law_state"),
  arbitrationLocation: text("arbitration_location"),
});

// =============================================================================
// FINANCIALS
// =============================================================================

export const financials = pgTable("financials", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  
  // Design Phase
  designFee: integer("design_fee"), // Store in cents
  designRevisionRounds: integer("design_revision_rounds").default(3),
  designRevisionCostOverage: integer("design_revision_cost_overage"),
  
  // Preliminary Pricing (at Design Agreement)
  prelimOffsite: integer("prelim_offsite"),
  prelimOnsite: integer("prelim_onsite"),
  prelimContractPrice: integer("prelim_contract_price"), // Total preliminary
  
  // Final Pricing (at Green Light)
  homeBasePrice: integer("home_base_price"),
  homeCustomizations: integer("home_customizations").default(0),
  finalOffsite: integer("final_offsite"), // Locked at Green Light
  refinedOnsite: integer("refined_onsite"), // Refined estimate
  finalContractPrice: integer("final_contract_price"),
  
  // Price Lock Status
  isLocked: boolean("is_locked").default(false),
  lockedAt: timestamp("locked_at"),
  lockedBy: text("locked_by"),
  
  // Inflation/Adjustment Triggers
  inflationTriggerDate: text("inflation_trigger_date"),
  inflationAdjustmentPercent: real("inflation_adjustment_percent").default(5.0),
  materialIncreaseThreshold: real("material_increase_threshold").default(10.0),
  
  // Liquidated Damages
  liquidatedDamagesPerDay: integer("liquidated_damages_per_day"),
  liquidatedDamagesCap: integer("liquidated_damages_cap"),
  onsiteLiquidatedDamagesPerDay: integer("onsite_liquidated_damages_per_day"),
  onsiteLiquidatedDamagesCap: integer("onsite_liquidated_damages_cap"),
});

// =============================================================================
// MILESTONES
// =============================================================================

export const milestones = pgTable("milestones", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  
  // Milestone Identity
  milestoneType: text("milestone_type").notNull(), // 'client', 'manufacturing', 'onsite'
  milestoneNumber: integer("milestone_number").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  
  // Payment Details
  percentage: real("percentage"),
  amount: integer("amount"), // Store in cents
  
  // Timing
  dueUpon: text("due_upon"), // Description of trigger (e.g., "Contract Execution", "Green Light")
  targetDate: text("target_date"),
  completedDate: text("completed_date"),
  
  // Status
  status: text("status").default("Pending"), // Pending, Due, Paid, Overdue
  paidDate: text("paid_date"),
  paidAmount: integer("paid_amount"),
  invoiceNumber: text("invoice_number"),
  
  // Notes
  notes: text("notes"),
});

// =============================================================================
// WARRANTY TERMS
// =============================================================================

export const warrantyTerms = pgTable("warranty_terms", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  
  // Dvele (Off-Site) Warranties
  dveleFitFinishMonths: integer("dvele_fit_finish_months").default(12),
  dveleStructuralMonths: integer("dvele_structural_months").default(120), // 10 years
  dveleSystemsMonths: integer("dvele_systems_months").default(24),
  dveleBuildingEnvelopeMonths: integer("dvele_building_envelope_months").default(60), // 5 years
  
  // On-Site Warranties (Company Managed)
  onsiteFitFinishMonths: integer("onsite_fit_finish_months").default(12),
  onsiteStructuralMonths: integer("onsite_structural_months").default(120),
  onsiteSystemsMonths: integer("onsite_systems_months").default(24),
  
  // Client-Retained Contractor Warranties (CRC)
  clientFitFinishMonths: integer("client_fit_finish_months").default(12),
  clientStructuralMonths: integer("client_structural_months").default(120),
  clientBuildingEnvelopeMonths: integer("client_building_envelope_months").default(60),
  
  // Custom Terms
  customWarrantyTerms: text("custom_warranty_terms"), // JSON for any non-standard terms
  warrantyStartDate: text("warranty_start_date"),
});

// =============================================================================
// CONTRACTORS
// =============================================================================

export const contractors = pgTable("contractors", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  
  // Contractor Type
  contractorType: text("contractor_type").notNull(), // 'manufacturer', 'onsite_general', 'onsite_sub'
  
  // Entity Info
  legalName: text("legal_name").notNull(),
  state: text("state"),
  entityType: text("entity_type"), // LLC, Corporation, etc.
  
  // Address
  address: text("address"),
  city: text("city"),
  stateAddress: text("state_address"),
  zip: text("zip"),
  
  // Licensing
  licenseNumber: text("license_number"),
  licenseState: text("license_state"),
  licenseExpiration: text("license_expiration"),
  
  // Contact
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  
  // Insurance & Bonding
  bondAmount: integer("bond_amount"),
  insuranceAmount: integer("insurance_amount"),
  insuranceExpiration: text("insurance_expiration"),
  insuranceCarrier: text("insurance_carrier"),
  
  // Status
  isActive: boolean("is_active").default(true),
});

// =============================================================================
// GENERATED CONTRACTS
// =============================================================================

export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  
  // Contract Identity
  contractType: text("contract_type").notNull(), // 'one_agreement', 'manufacturing_sub', 'onsite_sub'
  version: integer("version").default(1),
  
  // Status Tracking
  status: text("status").default("Draft"), // Draft, PendingReview, Approved, Sent, Executed, Amended
  
  // Generation Info
  generatedAt: timestamp("generated_at").defaultNow(),
  generatedBy: text("generated_by"),
  templateVersion: text("template_version"),
  
  // File Storage
  filePath: text("file_path"),
  fileName: text("file_name"),
  fileHash: text("file_hash"), // For integrity verification
  
  // Variable Snapshot
  variablesSnapshot: text("variables_snapshot"), // JSON of all variables at generation time
  
  // Execution
  sentAt: timestamp("sent_at"),
  sentTo: text("sent_to"),
  executedAt: timestamp("executed_at"),
  executedFilePath: text("executed_file_path"),
  
  // Notes
  notes: text("notes"),
});

// =============================================================================
// ERP FIELD MAPPINGS (Odoo Integration)
// =============================================================================

export const erpFieldMappings = pgTable("erp_field_mappings", {
  id: serial("id").primaryKey(),
  
  // Contract Variable
  variableName: text("variable_name").notNull().unique(),
  variableDescription: text("variable_description"),
  variableCategory: text("variable_category"), // client, project, financial, dates, warranty
  
  // Odoo Mapping
  odooModel: text("odoo_model"), // e.g., "res.partner", "sale.order"
  odooField: text("odoo_field"), // e.g., "name", "amount_total"
  odooRelatedField: text("odoo_related_field"), // For nested fields like "partner_id.name"
  
  // Transformation
  transformFunction: text("transform_function"), // Optional JS function name for transformation
  defaultValue: text("default_value"),
  
  // Validation
  isRequired: boolean("is_required").default(false),
  validationRegex: text("validation_regex"),
  
  // Status
  isActive: boolean("is_active").default(true),
  lastSyncedAt: timestamp("last_synced_at"),
});

// =============================================================================
// CLAUSE LIBRARY - Contract Content Management
// =============================================================================

export const contractTemplates = pgTable("contract_templates", {
  id: serial("id").primaryKey(),
  contractType: text("contract_type").notNull(), // 'ONE', 'MANUFACTURING', 'ONSITE'
  version: text("version").default("1.0"),
  displayName: text("display_name"),
  baseClauseIds: text("base_clause_ids").array(), // Array of clause IDs
  conditionalRules: text("conditional_rules"), // JSONB for conditional logic
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const clauses = pgTable("clauses", {
  id: serial("id").primaryKey(),
  clauseCode: text("clause_code"), // e.g., "1.1", "2.3.4"
  parentClauseId: integer("parent_clause_id"),
  hierarchyLevel: integer("hierarchy_level"), // 0=section, 1=subsection, 2=paragraph
  sortOrder: integer("sort_order"),
  name: text("name"), // Clause title
  category: text("category"), // 'scope', 'payment', 'warranty', 'termination', etc.
  contractType: text("contract_type"), // 'ONE', 'MANUFACTURING', 'ONSITE'
  content: text("content").notNull(), // The actual clause content
  variablesUsed: text("variables_used").array(), // Array of variable names
  conditions: text("conditions"), // JSONB for conditional logic
  riskLevel: text("risk_level"), // 'low', 'medium', 'high'
  negotiable: boolean("negotiable").default(true),
  owner: text("owner"), // Who owns/maintains this clause
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const contractVariables = pgTable("contract_variables", {
  id: serial("id").primaryKey(),
  variableName: text("variable_name").notNull().unique(), // e.g., "CLIENT_LEGAL_NAME"
  displayName: text("display_name"),
  category: text("category"), // client, project, financial, dates, warranty, llc, site
  dataType: text("data_type").default("text"), // text, number, date, currency, boolean
  defaultValue: text("default_value"),
  validationRules: text("validation_rules"), // JSONB
  usedInContracts: text("used_in_contracts").array(), // Array: ['ONE', 'MANUFACTURING', 'ONSITE']
  isRequired: boolean("is_required").default(false),
  description: text("description"),
  erpSource: text("erp_source"), // ERP field mapping, e.g., "Customers.LegalName"
  createdAt: timestamp("created_at").defaultNow(),
});

// =============================================================================
// RELATIONS
// =============================================================================

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, {
    fields: [projects.id],
    references: [clients.projectId],
  }),
  childLlc: one(childLlcs, {
    fields: [projects.id],
    references: [childLlcs.projectId],
  }),
  projectDetails: one(projectDetails, {
    fields: [projects.id],
    references: [projectDetails.projectId],
  }),
  financials: one(financials, {
    fields: [projects.id],
    references: [financials.projectId],
  }),
  warrantyTerms: one(warrantyTerms, {
    fields: [projects.id],
    references: [warrantyTerms.projectId],
  }),
  milestones: many(milestones),
  contractors: many(contractors),
  contracts: many(contracts),
}));

export const clientsRelations = relations(clients, ({ one }) => ({
  project: one(projects, {
    fields: [clients.projectId],
    references: [projects.id],
  }),
}));

export const childLlcsRelations = relations(childLlcs, ({ one }) => ({
  project: one(projects, {
    fields: [childLlcs.projectId],
    references: [projects.id],
  }),
}));

export const projectDetailsRelations = relations(projectDetails, ({ one }) => ({
  project: one(projects, {
    fields: [projectDetails.projectId],
    references: [projects.id],
  }),
}));

export const financialsRelations = relations(financials, ({ one }) => ({
  project: one(projects, {
    fields: [financials.projectId],
    references: [projects.id],
  }),
}));

export const warrantyTermsRelations = relations(warrantyTerms, ({ one }) => ({
  project: one(projects, {
    fields: [warrantyTerms.projectId],
    references: [projects.id],
  }),
}));

export const milestonesRelations = relations(milestones, ({ one }) => ({
  project: one(projects, {
    fields: [milestones.projectId],
    references: [projects.id],
  }),
}));

export const contractorsRelations = relations(contractors, ({ one }) => ({
  project: one(projects, {
    fields: [contractors.projectId],
    references: [projects.id],
  }),
}));

export const contractsRelations = relations(contracts, ({ one }) => ({
  project: one(projects, {
    fields: [contracts.projectId],
    references: [projects.id],
  }),
}));

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export type ChildLlc = typeof childLlcs.$inferSelect;
export type NewChildLlc = typeof childLlcs.$inferInsert;

export type ProjectDetails = typeof projectDetails.$inferSelect;
export type NewProjectDetails = typeof projectDetails.$inferInsert;

export type Financial = typeof financials.$inferSelect;
export type NewFinancial = typeof financials.$inferInsert;

export type Milestone = typeof milestones.$inferSelect;
export type NewMilestone = typeof milestones.$inferInsert;

export type WarrantyTerm = typeof warrantyTerms.$inferSelect;
export type NewWarrantyTerm = typeof warrantyTerms.$inferInsert;

export type Contractor = typeof contractors.$inferSelect;
export type NewContractor = typeof contractors.$inferInsert;

export type Contract = typeof contracts.$inferSelect;
export type NewContract = typeof contracts.$inferInsert;

export type ErpFieldMapping = typeof erpFieldMappings.$inferSelect;
export type NewErpFieldMapping = typeof erpFieldMappings.$inferInsert;

export type ContractTemplate = typeof contractTemplates.$inferSelect;
export type NewContractTemplate = typeof contractTemplates.$inferInsert;

export type Clause = typeof clauses.$inferSelect;
export type NewClause = typeof clauses.$inferInsert;

export type ContractVariable = typeof contractVariables.$inferSelect;
export type NewContractVariable = typeof contractVariables.$inferInsert;

// =============================================================================
// ZOD SCHEMAS (for form validation)
// =============================================================================

export const insertProjectSchema = createInsertSchema(projects);
export const selectProjectSchema = createSelectSchema(projects);

export const insertClientSchema = createInsertSchema(clients);
export const selectClientSchema = createSelectSchema(clients);

export const insertChildLlcSchema = createInsertSchema(childLlcs);
export const selectChildLlcSchema = createSelectSchema(childLlcs);

export const insertContractSchema = createInsertSchema(contracts);
export const selectContractSchema = createSelectSchema(contracts);

export const insertFinancialSchema = createInsertSchema(financials);
export const insertMilestoneSchema = createInsertSchema(milestones);
export const insertContractorSchema = createInsertSchema(contractors);
export const insertWarrantyTermSchema = createInsertSchema(warrantyTerms);
export const insertProjectDetailsSchema = createInsertSchema(projectDetails);

// =============================================================================
// LEGACY COMPATIBILITY (for existing llc-admin page)
// =============================================================================

// Enhanced LLC table with full administration features
export const llcs = pgTable("llcs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  projectName: text("project_name").notNull(),
  projectId: integer("project_id"), // Link to project if exists
  clientLastName: text("client_last_name"), // For auto-generation
  deliveryAddress: text("delivery_address"), // For auto-generation
  status: text("status").default("forming"), // forming, active, closed
  stateOfFormation: text("state_of_formation").default("Delaware"),
  einNumber: text("ein_number"),
  registeredAgent: text("registered_agent"),
  registeredAgentAddress: text("registered_agent_address"),
  formationDate: text("formation_date"),
  // Address
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  // Members/Ownership
  members: text("members"), // JSON array of members
  // Compliance tracking
  annualReportDueDate: text("annual_report_due_date"),
  annualReportStatus: text("annual_report_status").default("pending"), // pending, filed, overdue
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLLCSchema = createInsertSchema(llcs);
export const selectLLCSchema = createSelectSchema(llcs);

export type LLC = typeof llcs.$inferSelect;
export type NewLLC = typeof llcs.$inferInsert;

// =============================================================================
// DASHBOARD TYPES
// =============================================================================

export interface DashboardStats {
  totalContracts: number;
  drafts: number;
  pendingReview: number;
  signed: number;
  activeProjects: number;
  pendingLLCs: number;
  totalContractValue: number;
  draftsValue: number;
  pendingValue: number;
  signedValue: number;
}
