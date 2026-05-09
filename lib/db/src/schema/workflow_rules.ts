import { pgTable, text, serial, timestamp, numeric, integer, boolean, jsonb } from "drizzle-orm/pg-core";

export const workflowRulesTable = pgTable("workflow_rules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  name: text("name").notNull(),
  description: text("description"),
  minAmount: numeric("min_amount", { precision: 12, scale: 2 }).default("0"),
  maxAmount: numeric("max_amount", { precision: 12, scale: 2 }),
  requiredApprovers: jsonb("required_approvers").notNull().default([]),
  stages: jsonb("stages").notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WorkflowRule = typeof workflowRulesTable.$inferSelect;
