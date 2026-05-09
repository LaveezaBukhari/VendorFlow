import { pgTable, text, serial, timestamp, numeric, integer, jsonb } from "drizzle-orm/pg-core";

export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  poNumber: text("po_number").notNull().unique(),
  vendorId: integer("vendor_id").notNull(),
  items: jsonb("items").notNull().default([]),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("draft"),
  priority: text("priority").notNull().default("normal"),
  currentStage: integer("current_stage").notNull().default(0),
  workflowRuleId: integer("workflow_rule_id"),
  notes: text("notes"),
  rejectionReason: text("rejection_reason"),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  approvalHistory: jsonb("approval_history").notNull().default([]),
  createdBy: integer("created_by").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;
