import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectNumber: text("project_number").unique().notNull(),
  name: text("name").notNull(),
  status: text("status").default("Draft").notNull(),
  state: text("state"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .references(() => projects.id)
    .notNull(),
  legalName: text("legal_name").notNull(),
  address: text("address"),
  email: text("email"),
  phone: text("phone"),
  entityType: text("entity_type"),
});

export const childLlcs = sqliteTable("child_llcs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .references(() => projects.id)
    .notNull(),
  legalName: text("legal_name").notNull(),
  ein: text("ein"),
  insuranceStatus: text("insurance_status").default("Pending").notNull(),
  formationDate: text("formation_date"),
});

export const financials = sqliteTable("financials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .references(() => projects.id)
    .notNull(),
  designFee: integer("design_fee"),
  prelimOffsite: integer("prelim_offsite"),
  prelimOnsite: integer("prelim_onsite"),
  finalOffsite: integer("final_offsite"),
  refinedOnsite: integer("refined_onsite"),
  isLocked: integer("is_locked", { mode: "boolean" }).default(false),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export type ChildLlc = typeof childLlcs.$inferSelect;
export type NewChildLlc = typeof childLlcs.$inferInsert;

export type Financial = typeof financials.$inferSelect;
export type NewFinancial = typeof financials.$inferInsert;
