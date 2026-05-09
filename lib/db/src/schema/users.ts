import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("procurement_officer"),
  refreshToken: text("refresh_token"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  lastLogin: timestamp("last_login", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
