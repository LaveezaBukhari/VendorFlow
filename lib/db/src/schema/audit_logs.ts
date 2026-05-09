import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  userRole: text("user_role").notNull().default("unknown"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  before: jsonb("before").default(null),
  after: jsonb("after").default(null),
  changes: jsonb("changes").notNull().default({}),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  correlationId: text("correlation_id"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
