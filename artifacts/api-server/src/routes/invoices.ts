import { Router } from "express";
import { db, invoicesTable, purchaseOrdersTable, vendorsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth";
import { writeAudit } from "../lib/audit";

const router = Router();

const FINANCE_ROLES = ["super_admin", "company_admin", "finance_officer"];

const generateSchema = z.object({
  purchaseOrderId: z.number().int().positive(),
  taxRate: z.number().min(0).max(100).default(0),
  dueDate: z.string(),
  notes: z.string().optional(),
  currency: z.string().default("USD"),
});

const updateSchema = z.object({
  status: z.enum(["issued", "paid", "overdue", "cancelled"]).optional(),
  notes: z.string().optional(),
  paidAt: z.string().optional().nullable(),
});

let invoiceCounter = 1000;

function fmtInvoice(inv: any) {
  return {
    ...inv,
    subtotal: parseFloat(inv.subtotal ?? "0"),
    taxRate: parseFloat(inv.taxRate ?? "0"),
    taxAmount: parseFloat(inv.taxAmount ?? "0"),
    totalAmount: parseFloat(inv.totalAmount ?? "0"),
  };
}

// List invoices for a tenant
router.get("/invoices", authenticate, async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const status = req.query.status as string | undefined;
  const vendorId = req.query.vendorId ? parseInt(req.query.vendorId as string) : undefined;

  let invoices = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.tenantId, tenantId));

  if (status) invoices = invoices.filter((i) => i.status === status);
  if (vendorId) invoices = invoices.filter((i) => i.vendorId === vendorId);

  invoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Enrich with vendor names
  const vendors = await db.select().from(vendorsTable).where(eq(vendorsTable.tenantId, tenantId));
  const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v.name]));

  const enriched = invoices.map((inv) => ({
    ...fmtInvoice(inv),
    vendorName: vendorMap[inv.vendorId] ?? "Unknown",
  }));

  const page = parseInt((req.query.page as string) ?? "1", 10) || 1;
  const limit = Math.min(parseInt((req.query.limit as string) ?? "50", 10) || 50, 200);
  const paged = enriched.slice((page - 1) * limit, page * limit);

  res.json({ data: paged, total: enriched.length, page, limit, totalPages: Math.ceil(enriched.length / limit) });
});

// Generate an invoice from an approved purchase order
router.post(
  "/invoices",
  authenticate,
  authorize(...FINANCE_ROLES),
  async (req, res): Promise<void> => {
    const tenantId = (req as any).user.tenantId;
    const user = (req as any).user;

    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    // Fetch and validate the PO
    const pos = await db
      .select()
      .from(purchaseOrdersTable)
      .where(
        and(
          eq(purchaseOrdersTable.id, parsed.data.purchaseOrderId),
          eq(purchaseOrdersTable.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!pos.length) {
      res.status(404).json({ error: "Purchase order not found" });
      return;
    }

    const po = pos[0];

    if (po.status !== "approved") {
      res.status(422).json({ error: "Invoices can only be generated for approved purchase orders" });
      return;
    }

    // Check for duplicate invoice
    const existing = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.purchaseOrderId, po.id))
      .limit(1);
    if (existing.length) {
      res.status(409).json({ error: "An invoice already exists for this purchase order", invoiceId: existing[0].id });
      return;
    }

    invoiceCounter++;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCounter).padStart(5, "0")}`;

    const subtotal = parseFloat(po.totalAmount ?? "0");
    const taxAmount = parseFloat(((subtotal * parsed.data.taxRate) / 100).toFixed(2));
    const totalAmount = parseFloat((subtotal + taxAmount).toFixed(2));

    const [invoice] = await db
      .insert(invoicesTable)
      .values({
        tenantId,
        invoiceNumber,
        purchaseOrderId: po.id,
        vendorId: po.vendorId,
        lineItems: po.items,
        subtotal: String(subtotal),
        taxRate: String(parsed.data.taxRate),
        taxAmount: String(taxAmount),
        totalAmount: String(totalAmount),
        currency: parsed.data.currency,
        dueDate: new Date(parsed.data.dueDate),
        notes: parsed.data.notes ?? null,
        createdBy: user.userId,
      })
      .returning();

    await writeAudit({
      req,
      action: "created",
      entityType: "Invoice",
      entityId: invoice.id,
      after: { invoiceNumber, totalAmount, poId: po.id },
    });

    res.status(201).json(fmtInvoice(invoice));
  },
);

// Get a single invoice
router.get("/invoices/:id", authenticate, async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const invoices = await db
    .select()
    .from(invoicesTable)
    .where(and(eq(invoicesTable.id, id), eq(invoicesTable.tenantId, tenantId)))
    .limit(1);
  if (!invoices.length) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const inv = invoices[0];
  const vendor = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.id, inv.vendorId))
    .limit(1);
  const po = await db
    .select()
    .from(purchaseOrdersTable)
    .where(eq(purchaseOrdersTable.id, inv.purchaseOrderId))
    .limit(1);

  res.json({
    ...fmtInvoice(inv),
    vendorName: vendor[0]?.name ?? "Unknown",
    poNumber: po[0]?.poNumber ?? "Unknown",
  });
});

// Update invoice status (e.g., mark as paid)
router.patch(
  "/invoices/:id",
  authenticate,
  authorize(...FINANCE_ROLES),
  async (req, res): Promise<void> => {
    const tenantId = (req as any).user.tenantId;
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const existing = await db
      .select()
      .from(invoicesTable)
      .where(and(eq(invoicesTable.id, id), eq(invoicesTable.tenantId, tenantId)))
      .limit(1);
    if (!existing.length) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    const updateData: any = { ...parsed.data };
    if (parsed.data.status === "paid" && !parsed.data.paidAt) {
      updateData.paidAt = new Date();
    } else if (parsed.data.paidAt) {
      updateData.paidAt = new Date(parsed.data.paidAt);
    }

    const [updated] = await db
      .update(invoicesTable)
      .set(updateData)
      .where(eq(invoicesTable.id, id))
      .returning();

    await writeAudit({
      req,
      action: `invoice_${parsed.data.status ?? "updated"}`,
      entityType: "Invoice",
      entityId: id,
      before: { status: existing[0].status },
      after: { status: updated.status },
    });

    res.json(fmtInvoice(updated));
  },
);

export default router;
