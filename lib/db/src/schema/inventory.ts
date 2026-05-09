import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";

export const inventoryTable = pgTable("inventory", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull().default("0"),
  reservedQuantity: numeric("reserved_quantity", { precision: 12, scale: 2 }).notNull().default("0"),
  reorderLevel: numeric("reorder_level", { precision: 12, scale: 2 }).notNull().default("0"),
  warehouseLocation: text("warehouse_location").notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  category: text("category").notNull(),
  vendorId: integer("vendor_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type InventoryItem = typeof inventoryTable.$inferSelect;
