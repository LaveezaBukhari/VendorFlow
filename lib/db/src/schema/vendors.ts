import { pgTable, text, serial, timestamp, numeric, integer, boolean, jsonb } from "drizzle-orm/pg-core";

export const vendorsTable = pgTable("vendors", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  category: text("category").notNull(),
  taxId: text("tax_id"),
  website: text("website"),
  rating: numeric("rating", { precision: 3, scale: 1 }).notNull().default("0"),
  riskScore: integer("risk_score").notNull().default(50),
  totalSpent: numeric("total_spent", { precision: 12, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("active"),
  isBlacklisted: boolean("is_blacklisted").notNull().default(false),
  blacklistReason: text("blacklist_reason"),
  complianceExpiry: timestamp("compliance_expiry", { withTimezone: true }),
  performanceMetrics: jsonb("performance_metrics").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Vendor = typeof vendorsTable.$inferSelect;
