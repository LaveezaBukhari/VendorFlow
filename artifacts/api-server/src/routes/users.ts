import { Router } from "express";
import { db, usersTable, tenantsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authenticate, authorize } from "../middleware/auth";
import { writeAudit } from "../lib/audit";

const router = Router();

const ADMIN_ROLES = ["super_admin", "company_admin"];

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  password: z.string().min(8),
  role: z.enum([
    "super_admin",
    "company_admin",
    "procurement_officer",
    "finance_officer",
    "inventory_manager",
    "auditor",
    "read_only",
  ]),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z
    .enum([
      "super_admin",
      "company_admin",
      "procurement_officer",
      "finance_officer",
      "inventory_manager",
      "auditor",
      "read_only",
    ])
    .optional(),
  isActive: z.boolean().optional(),
});

function safeUser(u: typeof usersTable.$inferSelect) {
  const { passwordHash: _, refreshToken: __, ...rest } = u;
  return rest;
}

// List all users in the tenant
router.get("/users", authenticate, authorize(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const role = req.query.role as string | undefined;
  const isActive = req.query.isActive;

  let users = await db.select().from(usersTable).where(eq(usersTable.tenantId, tenantId));

  if (role) users = users.filter((u) => u.role === role);
  if (isActive !== undefined) users = users.filter((u) => u.isActive === (isActive === "true"));

  users.sort((a, b) => a.name.localeCompare(b.name));

  const page = parseInt((req.query.page as string) ?? "1", 10) || 1;
  const limit = Math.min(parseInt((req.query.limit as string) ?? "50", 10) || 50, 200);
  const paged = users.slice((page - 1) * limit, page * limit);

  res.json({ data: paged.map(safeUser), total: users.length, page, limit, totalPages: Math.ceil(users.length / limit) });
});

// Create a new user within the tenant
router.post("/users", authenticate, authorize(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const actingUser = (req as any).user;

  // Only super_admin can create another super_admin
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  if (parsed.data.role === "super_admin" && actingUser.role !== "super_admin") {
    res.status(403).json({ error: "Only super admins can create super admin accounts" });
    return;
  }

  // Check email uniqueness within tenant
  const existing = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.email, parsed.data.email), eq(usersTable.tenantId, tenantId)))
    .limit(1);
  if (existing.length) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({ ...parsed.data, passwordHash, tenantId })
    .returning();

  await writeAudit({
    req,
    action: "created",
    entityType: "User",
    entityId: user.id,
    after: safeUser(user),
  });

  res.status(201).json(safeUser(user));
});

// Get a single user
router.get("/users/:id", authenticate, authorize(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.tenantId, tenantId)))
    .limit(1);
  if (!users.length) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(safeUser(users[0]));
});

// Update a user (role, name, active status)
router.patch("/users/:id", authenticate, authorize(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const actingUser = (req as any).user;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const existing = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.tenantId, tenantId)))
    .limit(1);
  if (!existing.length) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  // Prevent privilege escalation
  if (parsed.data.role === "super_admin" && actingUser.role !== "super_admin") {
    res.status(403).json({ error: "Only super admins can assign the super_admin role" });
    return;
  }

  // Prevent self-deactivation
  if (parsed.data.isActive === false && id === actingUser.userId) {
    res.status(400).json({ error: "You cannot deactivate your own account" });
    return;
  }

  const [updated] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, id)).returning();

  await writeAudit({
    req,
    action: "updated",
    entityType: "User",
    entityId: id,
    before: safeUser(existing[0]),
    after: safeUser(updated),
    changes: Object.keys(parsed.data).reduce(
      (acc, k) => ({
        ...acc,
        [k]: { before: (existing[0] as any)[k], after: (updated as any)[k] },
      }),
      {},
    ),
  });

  res.json(safeUser(updated));
});

// Change password (self or admin)
router.patch("/users/:id/password", authenticate, async (req, res): Promise<void> => {
  const actingUser = (req as any).user;
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const isAdmin = ADMIN_ROLES.includes(actingUser.role);
  const isSelf = actingUser.userId === id;

  if (!isAdmin && !isSelf) {
    res.status(403).json({ error: "Cannot change another user's password" });
    return;
  }

  const schema = isSelf
    ? z.object({ currentPassword: z.string(), newPassword: z.string().min(8) })
    : z.object({ newPassword: z.string().min(8) });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.tenantId, actingUser.tenantId)))
    .limit(1);
  if (!users.length) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (isSelf && "currentPassword" in parsed.data) {
    const valid = await bcrypt.compare(String(parsed.data.currentPassword), users[0].passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  // Invalidate refresh token on password change
  await db
    .update(usersTable)
    .set({ passwordHash, refreshToken: null })
    .where(eq(usersTable.id, id));

  await writeAudit({ req, action: "password_changed", entityType: "User", entityId: id });

  res.json({ message: "Password updated successfully" });
});

// Delete a user (soft delete via deactivation, hard delete for super_admin)
router.delete(
  "/users/:id",
  authenticate,
  authorize("super_admin", "company_admin"),
  async (req, res): Promise<void> => {
    const tenantId = (req as any).user.tenantId;
    const actingUser = (req as any).user;
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    if (id === actingUser.userId) {
      res.status(400).json({ error: "You cannot delete your own account" });
      return;
    }

    const existing = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, id), eq(usersTable.tenantId, tenantId)))
      .limit(1);
    if (!existing.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Soft delete: deactivate and invalidate tokens
    await db
      .update(usersTable)
      .set({ isActive: false, refreshToken: null })
      .where(eq(usersTable.id, id));

    await writeAudit({
      req,
      action: "deactivated",
      entityType: "User",
      entityId: id,
      before: safeUser(existing[0]),
    });

    res.json({ message: "User deactivated" });
  },
);

export default router;
