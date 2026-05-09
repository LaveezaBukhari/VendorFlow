import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";

export const inventoryMovementsTable = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  inventoryItemId: integer("inventory_item_id").notNull(),
  movementType: text("movement_type").notNull(), // received, issued, adjusted, reserved
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  previousQuantity: numeric("previous_quantity", { precision: 12, scale: 2 }).notNull(),
  newQuantity: numeric("new_quantity", { precision: 12, scale: 2 }).notNull(),
  reference: text("reference"),
  performedBy: integer("performed_by").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InventoryMovement = typeof inventoryMovementsTable.$inferSelect;
