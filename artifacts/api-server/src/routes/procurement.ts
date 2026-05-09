import { Router } from "express";
import { db, purchaseOrdersTable, vendorsTable, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { getPagination, paginate } from "../lib/pagination";

const router = Router();

const WRITE_ROLES = ["super_admin", "company_admin", "procurement_officer", "finance_officer"];
const APPROVE_ROLES = ["super_admin", "company_admin", "finance_officer"];

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  category: z.string().min(1),
});

const poSchema = z.object({
  vendorId: z.number().int().positive(),
  items: z.array(itemSchema).min(1),
  notes: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  dueDate: z.string(),
});

const statusSchema = z.object({
  status: z.enum(["draft", "submitted", "approved", "rejected", "received", "cancelled"]),
  rejectionReason: z.string().optional().nullable(),
  notes: z.string().optional(),
});

function computeItems(raw: z.infer<typeof itemSchema>[]) {
  return raw.map((item, idx) => ({
    id: idx + 1,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: parseFloat((item.quantity * item.unitPrice).toFixed(2)),
    category: item.category,
  }));
}

function computeTotal(items: ReturnType<typeof computeItems>) {
  return parseFloat(items.reduce((sum, i) => sum + i.total, 0).toFixed(2));
}

async function fmtPO(po: any) {
  const vendor = await db.select().from(vendorsTable).where(eq(vendorsTable.id, po.vendorId)).limit(1);
  return {
    ...po,
    vendorName: vendor[0]?.name ?? "Unknown",
    totalAmount: parseFloat(po.totalAmount ?? "0"),
    items: po.items || [],
    approvalHistory: po.approvalHistory || [],
  };
}

let poCounter = 2000;

router.get("/procurement", authenticate, async (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const { page, limit, offset } = getPagination(req);
  const status = req.query.status as string;
  const priority = req.query.priority as string;
  const vendorId = req.query.vendorId ? parseInt(req.query.vendorId as string) : undefined;

  let all = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.tenantId, tenantId));

  if (status) all = all.filter(p => p.status === status);
  if (priority) all = all.filter(p => p.priority === priority);
  if (vendorId) all = all.filter(p => p.vendorId === vendorId);

  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json(await Promise.all(all.map(fmtPO)));
});

router.post("/procurement", authenticate, authorize(...WRITE_ROLES), async (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const user = (req as any).user;
  const parsed = poSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });

  poCounter++;
  const poNumber = `PO-${new Date().getFullYear()}-${String(poCounter).padStart(4, "0")}`;
  const items = computeItems(parsed.data.items);
  const total = computeTotal(items);

  const [po] = await db.insert(purchaseOrdersTable).values({
    tenantId,
    poNumber,
    vendorId: parsed.data.vendorId,
    items,
    totalAmount: String(total),
    status: "draft",
    priority: parsed.data.priority,
    notes: parsed.data.notes ?? null,
    dueDate: new Date(parsed.data.dueDate),
    createdBy: user.userId,
    approvalHistory: [],
  }).returning();

  await writeAudit({ req, action: "created", entityType: "PurchaseOrder", entityId: po.id, after: { poNumber, total, status: "draft" } });
  return res.status(201).json(await fmtPO(po));
});

router.get("/procurement/:id", authenticate, async (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const pos = await db.select().from(purchaseOrdersTable)
    .where(and(eq(purchaseOrdersTable.id, id), eq(purchaseOrdersTable.tenantId, tenantId))).limit(1);
  if (!pos.length) return res.status(404).json({ error: "Purchase order not found" });
  return res.json(await fmtPO(pos[0]));
});

router.patch("/procurement/:id", authenticate, authorize(...WRITE_ROLES), async (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const existing = await db.select().from(purchaseOrdersTable)
    .where(and(eq(purchaseOrdersTable.id, id), eq(purchaseOrdersTable.tenantId, tenantId))).limit(1);
  if (!existing.length) return res.status(404).json({ error: "Not found" });

  if (!["draft", "rejected"].includes(existing[0].status)) {
    return res.status(409).json({ error: "Can only edit draft or rejected orders" });
  }

  const parsed = poSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const updateData: any = {};
  if (parsed.data.vendorId !== undefined) updateData.vendorId = parsed.data.vendorId;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
  if (parsed.data.priority !== undefined) updateData.priority = parsed.data.priority;
  if (parsed.data.dueDate !== undefined) updateData.dueDate = new Date(parsed.data.dueDate);
  if (parsed.data.items) {
    const items = computeItems(parsed.data.items);
    updateData.items = items;
    updateData.totalAmount = String(computeTotal(items));
  }

  const [updated] = await db.update(purchaseOrdersTable).set(updateData).where(eq(purchaseOrdersTable.id, id)).returning();
  await writeAudit({ req, action: "updated", entityType: "PurchaseOrder", entityId: id, before: existing[0], after: updated });
  return res.json(await fmtPO(updated));
});

router.patch("/procurement/:id/status", authenticate, async (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const user = (req as any).user;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const existing = await db.select().from(purchaseOrdersTable)
    .where(and(eq(purchaseOrdersTable.id, id), eq(purchaseOrdersTable.tenantId, tenantId))).limit(1);
  if (!existing.length) return res.status(404).json({ error: "Not found" });

  const { status } = parsed.data;

  // Approval gate — only approvers can approve/reject
  if (["approved", "rejected"].includes(status) && !APPROVE_ROLES.includes(user.role)) {
    return res.status(403).json({ error: "Insufficient permissions to approve/reject orders" });
  }

  const historyEntry = {
    status,
    userId: user.userId,
    userEmail: user.email,
    role: user.role,
    timestamp: new Date().toISOString(),
    notes: parsed.data.notes ?? null,
    rejectionReason: parsed.data.rejectionReason ?? null,
  };

  const updatedHistory = [...((existing[0].approvalHistory as any[]) || []), historyEntry];

  const [updated] = await db.update(purchaseOrdersTable)
    .set({ status, rejectionReason: parsed.data.rejectionReason ?? null, approvalHistory: updatedHistory })
    .where(eq(purchaseOrdersTable.id, id))
    .returning();

  // Create notification for status changes
  await db.insert(notificationsTable).values({
    tenantId,
    userId: existing[0].createdBy,
    type: `po_${status}`,
    title: `Purchase Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    message: `${updated.poNumber} has been ${status}${parsed.data.rejectionReason ? `: ${parsed.data.rejectionReason}` : ""}.`,
    relatedEntityId: String(id),
    relatedEntityType: "PurchaseOrder",
  });

  await writeAudit({
    req, action: `status_changed_to_${status}`, entityType: "PurchaseOrder", entityId: id,
    before: { status: existing[0].status }, after: { status },
  });

  return res.json(await fmtPO(updated));
});

router.delete("/procurement/:id", authenticate, authorize("super_admin", "company_admin"), async (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const existing = await db.select().from(purchaseOrdersTable)
    .where(and(eq(purchaseOrdersTable.id, id), eq(purchaseOrdersTable.tenantId, tenantId))).limit(1);
  if (!existing.length) return res.status(404).json({ error: "Not found" });

  await db.delete(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  await writeAudit({ req, action: "deleted", entityType: "PurchaseOrder", entityId: id, before: existing[0] });
  return res.json({ message: "Purchase order deleted" });
});

export default router;
