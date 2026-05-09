import { Router } from "express";
import { db, vendorsTable } from "@workspace/db";
import { eq, and, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth";
import { writeAudit } from "../lib/audit";
import { getPagination, paginate } from "../lib/pagination";

const router = Router();

const WRITE_ROLES = ["super_admin", "company_admin", "procurement_officer"];

const vendorSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().min(1),
  address: z.string().min(1),
  category: z.string().min(1),
  taxId: z.string().optional(),
  website: z.string().optional(),
  rating: z.number().min(0).max(5).default(0),
  riskScore: z.number().int().min(0).max(100).default(50),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
  complianceExpiry: z.string().optional().nullable(),
});

function fmt(v: any) {
  return {
    ...v,
    rating: parseFloat(v.rating ?? "0"),
    riskScore: v.riskScore ?? 50,
    totalSpent: parseFloat(v.totalSpent ?? "0"),
  };
}

router.get("/vendors", authenticate, async (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const { page, limit, offset } = getPagination(req);
  const search = req.query.search as string;
  const status = req.query.status as string;
  const category = req.query.category as string;

  let all = await db.select().from(vendorsTable).where(eq(vendorsTable.tenantId, tenantId));

  if (search) {
    const q = search.toLowerCase();
    all = all.filter(v =>
      v.name.toLowerCase().includes(q) ||
      v.email.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q)
    );
  }
  if (status) all = all.filter(v => v.status === status);
  if (category) all = all.filter(v => v.category === category);

  all.sort((a, b) => a.name.localeCompare(b.name));

  return res.json(all.map(fmt));
});

router.post("/vendors", authenticate, authorize(...WRITE_ROLES), async (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const parsed = vendorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });

  const [vendor] = await db.insert(vendorsTable).values({
    ...parsed.data,
    tenantId,
    rating: String(parsed.data.rating),
    complianceExpiry: parsed.data.complianceExpiry ? new Date(parsed.data.complianceExpiry) : null,
  }).returning();

  await writeAudit({ req, action: "created", entityType: "Vendor", entityId: vendor.id, after: fmt(vendor) });
  return res.status(201).json(fmt(vendor));
});

router.get("/vendors/:id", authenticate, async (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const vendors = await db.select().from(vendorsTable)
    .where(and(eq(vendorsTable.id, id), eq(vendorsTable.tenantId, tenantId))).limit(1);
  if (!vendors.length) return res.status(404).json({ error: "Vendor not found" });
  return res.json(fmt(vendors[0]));
});

router.patch("/vendors/:id", authenticate, authorize(...WRITE_ROLES), async (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const existing = await db.select().from(vendorsTable)
    .where(and(eq(vendorsTable.id, id), eq(vendorsTable.tenantId, tenantId))).limit(1);
  if (!existing.length) return res.status(404).json({ error: "Vendor not found" });

  const parsed = vendorSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });

  const updateData: any = { ...parsed.data };
  if (parsed.data.rating !== undefined) updateData.rating = String(parsed.data.rating);
  if (parsed.data.complianceExpiry !== undefined) {
    updateData.complianceExpiry = parsed.data.complianceExpiry ? new Date(parsed.data.complianceExpiry) : null;
  }

  const [updated] = await db.update(vendorsTable).set(updateData).where(eq(vendorsTable.id, id)).returning();

  await writeAudit({
    req, action: "updated", entityType: "Vendor", entityId: id,
    before: fmt(existing[0]), after: fmt(updated),
    changes: Object.keys(parsed.data).reduce((acc, k) => ({ ...acc, [k]: { before: (existing[0] as any)[k], after: (updated as any)[k] } }), {}),
  });

  return res.json(fmt(updated));
});

router.patch("/vendors/:id/blacklist", authenticate, authorize("super_admin", "company_admin"), async (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const { reason, blacklisted } = req.body;
  const [updated] = await db.update(vendorsTable)
    .set({ isBlacklisted: blacklisted ?? true, blacklistReason: reason, status: blacklisted ? "suspended" : "active" })
    .where(and(eq(vendorsTable.id, id), eq(vendorsTable.tenantId, tenantId)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Vendor not found" });
  await writeAudit({ req, action: blacklisted ? "blacklisted" : "un-blacklisted", entityType: "Vendor", entityId: id, after: { reason } });
  return res.json(fmt(updated));
});

router.delete("/vendors/:id", authenticate, authorize("super_admin", "company_admin"), async (req, res) => {
  const tenantId = (req as any).user.tenantId;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const existing = await db.select().from(vendorsTable)
    .where(and(eq(vendorsTable.id, id), eq(vendorsTable.tenantId, tenantId))).limit(1);
  if (!existing.length) return res.status(404).json({ error: "Vendor not found" });

  await db.delete(vendorsTable).where(eq(vendorsTable.id, id));
  await writeAudit({ req, action: "deleted", entityType: "Vendor", entityId: id, before: fmt(existing[0]) });
  return res.json({ message: "Vendor deleted" });
});

export default router;
