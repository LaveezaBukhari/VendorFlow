import { Router } from "express";
import { db, inventoryTable, vendorsTable, inventoryMovementsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { getPagination, paginate } from "../lib/pagination";

const router = Router();

const WRITE_ROLES = ["super_admin", "company_admin", "inventory_manager", "procurement_officer"];

const itemSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  quantity: z.number().min(0),
  reorderLevel: z.number().min(0),
  warehouseLocation: z.string().min(1),
  unitCost: z.number().min(0),
  category: z.string().min(1),
  vendorId: z.number().int().nullable().optional(),
});

const movementSchema = z.object({
  movementType: z.enum(["received", "issued", "adjusted", "reserved"]),
  quantity: z.number(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

async function fmtItem(item: any) {
  let vendorName: string | null = null;
  if (item.vendorId) {
    const v = await db.select().from(vendorsTable).where(eq(vendorsTable.id, item.vendorId)).limit(1);
    vendorName = v[0]?.name ?? null;
  }
  return {
    ...item,
    quantity: parseFloat(item.quantity ?? "0"),
    reservedQuantity: parseFloat(item.reservedQuantity ?? "0"),
    reorderLevel: parseFloat(item.reorderLevel ?? "0"),
    unitCost: parseFloat(item.unitCost ?? "0"),
    vendorName,
  };
}

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

router.get("/inventory", authenticate, async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const search = req.query.search as string;
  const category = req.query.category as string;
  const lowStock = req.query.lowStock === "true";

  let all = await db.select().from(inventoryTable).where(eq(inventoryTable.tenantId, tenantId));

  if (search) {
    const q = search.toLowerCase();
    all = all.filter((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
  }
  if (category) all = all.filter((i) => i.category === category);
  if (lowStock) all = all.filter((i) => parseFloat(i.quantity ?? "0") <= parseFloat(i.reorderLevel ?? "0"));

  all.sort((a, b) => a.name.localeCompare(b.name));

  res.json(await Promise.all(all.map(fmtItem)));
});

router.post("/inventory", authenticate, authorize(...WRITE_ROLES), async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const [item] = await db.insert(inventoryTable).values({
    ...parsed.data,
    tenantId,
    quantity: String(parsed.data.quantity),
    reorderLevel: String(parsed.data.reorderLevel),
    unitCost: String(parsed.data.unitCost),
    vendorId: parsed.data.vendorId ?? null,
  }).returning();

  await writeAudit({ req, action: "created", entityType: "InventoryItem", entityId: item.id, after: await fmtItem(item) });
  res.status(201).json(await fmtItem(item));
});

router.get("/inventory/:id", authenticate, async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const items = await db.select().from(inventoryTable)
    .where(and(eq(inventoryTable.id, id), eq(inventoryTable.tenantId, tenantId))).limit(1);
  if (!items.length) { res.status(404).json({ error: "Item not found" }); return; }
  res.json(await fmtItem(items[0]));
});

router.patch("/inventory/:id", authenticate, authorize(...WRITE_ROLES), async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const existing = await db.select().from(inventoryTable)
    .where(and(eq(inventoryTable.id, id), eq(inventoryTable.tenantId, tenantId))).limit(1);
  if (!existing.length) { res.status(404).json({ error: "Not found" }); return; }

  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const updateData: any = { ...parsed.data };
  if (parsed.data.quantity !== undefined) updateData.quantity = String(parsed.data.quantity);
  if (parsed.data.reorderLevel !== undefined) updateData.reorderLevel = String(parsed.data.reorderLevel);
  if (parsed.data.unitCost !== undefined) updateData.unitCost = String(parsed.data.unitCost);

  const [updated] = await db.update(inventoryTable).set(updateData).where(eq(inventoryTable.id, id)).returning();

  if (parsed.data.quantity !== undefined) {
    const prevQty = parseFloat(existing[0].quantity ?? "0");
    const newQty = parsed.data.quantity;
    await db.insert(inventoryMovementsTable).values({
      tenantId,
      inventoryItemId: id,
      movementType: "adjusted",
      quantity: String(Math.abs(newQty - prevQty)),
      previousQuantity: String(prevQty),
      newQuantity: String(newQty),
      reference: "manual_adjustment",
      performedBy: (req as any).user.userId,
    });
  }

  await writeAudit({ req, action: "updated", entityType: "InventoryItem", entityId: id, before: existing[0], after: updated });
  res.json(await fmtItem(updated));
});

router.post("/inventory/:id/movement", authenticate, authorize(...WRITE_ROLES), async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = movementSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const items = await db.select().from(inventoryTable)
    .where(and(eq(inventoryTable.id, id), eq(inventoryTable.tenantId, tenantId))).limit(1);
  if (!items.length) { res.status(404).json({ error: "Item not found" }); return; }

  const current = parseFloat(items[0].quantity ?? "0");
  const qty = parsed.data.quantity;
  let newQty: number;

  switch (parsed.data.movementType) {
    case "received": newQty = current + qty; break;
    case "issued": newQty = Math.max(0, current - qty); break;
    case "adjusted": newQty = qty; break;
    case "reserved": newQty = current; break;
    default: newQty = current;
  }

  await db.update(inventoryTable).set({ quantity: String(newQty) }).where(eq(inventoryTable.id, id));

  const [movement] = await db.insert(inventoryMovementsTable).values({
    tenantId,
    inventoryItemId: id,
    movementType: parsed.data.movementType,
    quantity: String(qty),
    previousQuantity: String(current),
    newQuantity: String(newQty),
    reference: parsed.data.reference,
    notes: parsed.data.notes,
    performedBy: (req as any).user.userId,
  }).returning();

  await writeAudit({ req, action: `inventory_${parsed.data.movementType}`, entityType: "InventoryItem", entityId: id,
    before: { quantity: current }, after: { quantity: newQty } });

  res.json({ movement, newQuantity: newQty });
});

router.get("/inventory/:id/movements", authenticate, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const movements = await db.select().from(inventoryMovementsTable)
    .where(eq(inventoryMovementsTable.inventoryItemId, id));
  movements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(movements);
});

router.delete("/inventory/:id", authenticate, authorize("super_admin", "company_admin", "inventory_manager"), async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const existing = await db.select().from(inventoryTable)
    .where(and(eq(inventoryTable.id, id), eq(inventoryTable.tenantId, tenantId))).limit(1);
  if (!existing.length) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(inventoryTable).where(eq(inventoryTable.id, id));
  await writeAudit({ req, action: "deleted", entityType: "InventoryItem", entityId: id, before: existing[0] });
  res.json({ message: "Item deleted" });
});

export default router;
