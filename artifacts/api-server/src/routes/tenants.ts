import { Router } from "express";
import { db, tenantsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authenticate, authorize } from "../middleware/auth";
import { writeAudit } from "../lib/audit";

const router = Router();

const tenantSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  plan: z.enum(["standard", "professional", "enterprise"]).default("standard"),
});

const registerSchema = z.object({
  companyName: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  adminEmail: z.string().email(),
  adminName: z.string().min(1).max(200),
  adminPassword: z.string().min(8),
  plan: z.enum(["standard", "professional", "enterprise"]).default("standard"),
});

// Public: Register a new company (creates tenant + first admin user)
router.post("/tenants/register", async (req, res): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  // Check slug uniqueness
  const existingTenant = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.slug, parsed.data.slug))
    .limit(1);
  if (existingTenant.length) {
    res.status(409).json({ error: "This company slug is already taken" });
    return;
  }

  // Check email uniqueness
  const existingUser = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.adminEmail))
    .limit(1);
  if (existingUser.length) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  const [tenant] = await db
    .insert(tenantsTable)
    .values({
      name: parsed.data.companyName,
      slug: parsed.data.slug,
      plan: parsed.data.plan,
    })
    .returning();

  const passwordHash = await bcrypt.hash(parsed.data.adminPassword, 12);
  const [adminUser] = await db
    .insert(usersTable)
    .values({
      tenantId: tenant.id,
      email: parsed.data.adminEmail,
      name: parsed.data.adminName,
      passwordHash,
      role: "company_admin",
    })
    .returning();

  const { passwordHash: _, refreshToken: __, ...safeAdmin } = adminUser;

  res.status(201).json({
    tenant,
    adminUser: safeAdmin,
    message: "Company registered successfully. You can now log in.",
  });
});

// Super admin: List all tenants
router.get(
  "/tenants",
  authenticate,
  authorize("super_admin"),
  async (_req, res): Promise<void> => {
    const tenants = await db.select().from(tenantsTable).orderBy(tenantsTable.createdAt);
    // Attach user counts
    const users = await db.select().from(usersTable);
    const result = tenants.map((t) => ({
      ...t,
      userCount: users.filter((u) => u.tenantId === t.id).length,
    }));
    res.json(result);
  },
);

// Super admin: Get a specific tenant
router.get(
  "/tenants/:id",
  authenticate,
  authorize("super_admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const tenants = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, id))
      .limit(1);
    if (!tenants.length) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.tenantId, id));
    res.json({ ...tenants[0], users: users.map((u) => { const { passwordHash: _, refreshToken: __, ...safe } = u; return safe; }) });
  },
);

// Super admin: Update a tenant
router.patch(
  "/tenants/:id",
  authenticate,
  authorize("super_admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const existing = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.id, id))
      .limit(1);
    if (!existing.length) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    const parsed = tenantSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
      return;
    }

    if (parsed.data.slug) {
      const slugConflict = await db
        .select()
        .from(tenantsTable)
        .where(eq(tenantsTable.slug, parsed.data.slug))
        .limit(1);
      if (slugConflict.length && slugConflict[0].id !== id) {
        res.status(409).json({ error: "Slug already taken" });
        return;
      }
    }

    const [updated] = await db
      .update(tenantsTable)
      .set(parsed.data)
      .where(eq(tenantsTable.id, id))
      .returning();

    await writeAudit({
      req,
      action: "updated",
      entityType: "Tenant",
      entityId: id,
      before: existing[0],
      after: updated,
    });

    res.json(updated);
  },
);

// Super admin: Suspend/reactivate a tenant
router.patch(
  "/tenants/:id/status",
  authenticate,
  authorize("super_admin"),
  async (req, res): Promise<void> => {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);

    const [updated] = await db
      .update(tenantsTable)
      .set({ isActive })
      .where(eq(tenantsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Tenant not found" });
      return;
    }

    await writeAudit({
      req,
      action: isActive ? "tenant_activated" : "tenant_suspended",
      entityType: "Tenant",
      entityId: id,
    });

    res.json(updated);
  },
);

export default router;
