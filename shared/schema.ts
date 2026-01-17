import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const contractStatusEnum = ["draft", "pending_review", "approved", "signed", "expired"] as const;
export type ContractStatus = typeof contractStatusEnum[number];

export const llcStatusEnum = ["pending", "in_formation", "active", "dissolved"] as const;
export type LLCStatus = typeof llcStatusEnum[number];

export const llcs = pgTable("llcs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  projectName: text("project_name").notNull(),
  status: text("status").notNull().default("pending"),
  formationDate: timestamp("formation_date"),
  einNumber: text("ein_number"),
  stateOfFormation: text("state_of_formation").default("Delaware"),
  registeredAgent: text("registered_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  clientName: text("client_name").notNull(),
  llcId: varchar("llc_id").references(() => llcs.id),
  status: text("status").notNull().default("draft"),
  contractValue: decimal("contract_value", { precision: 12, scale: 2 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const llcsRelations = relations(llcs, ({ many }) => ({
  contracts: many(contracts),
}));

export const contractsRelations = relations(contracts, ({ one }) => ({
  llc: one(llcs, {
    fields: [contracts.llcId],
    references: [llcs.id],
  }),
}));

export const insertLLCSchema = createInsertSchema(llcs).omit({
  id: true,
  createdAt: true,
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertLLC = z.infer<typeof insertLLCSchema>;
export type LLC = typeof llcs.$inferSelect;

export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contracts.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export interface DashboardStats {
  totalContracts: number;
  drafts: number;
  pendingReview: number;
  signed: number;
  draftsValue: number;
  pendingValue: number;
  signedValue: number;
}
