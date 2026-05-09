import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  userId: integer("user_id").notNull().default(1),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  relatedEntityId: text("related_entity_id"),
  relatedEntityType: text("related_entity_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
