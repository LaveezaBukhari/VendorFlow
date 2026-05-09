import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt";
import { authenticate } from "../middleware/auth";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

function safeUser(u: any) {
  const { passwordHash: _, refreshToken: __, ...rest } = u;
  return rest;
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid credentials format" });
    return;
  }

  const { email, password } = parsed.data;

  let users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

  // Auto-provision demo user on first login
  if (users.length === 0) {
    let tenants = await db.select().from(tenantsTable).where(eq(tenantsTable.id, 1)).limit(1);
    if (tenants.length === 0) {
      await db.insert(tenantsTable).values({ id: 1, name: "Acme Corp", slug: "acme" }).onConflictDoNothing();
    }

    const hash = await bcrypt.hash(password, 12);
    const displayName = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    const [newUser] = await db
      .insert(usersTable)
      .values({ email, name: displayName, passwordHash: hash, role: "company_admin", tenantId: 1 })
      .returning();
    users = [newUser];
  } else {
    const valid = await bcrypt.compare(password, users[0].passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    if (!users[0].isActive) {
      res.status(403).json({ error: "Account deactivated" });
      return;
    }
  }

  const user = users[0];
  const payload = { userId: user.id, tenantId: user.tenantId, role: user.role, email: user.email };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await db.update(usersTable).set({ refreshToken, lastLogin: new Date() }).where(eq(usersTable.id, user.id));

  res.json({ accessToken, refreshToken, user: safeUser(user) });
});

router.post("/auth/refresh", async (req, res): Promise<void> => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Refresh token required" });
    return;
  }

  try {
    const payload = verifyRefreshToken(parsed.data.refreshToken);
    const users = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
    if (!users.length || users[0].refreshToken !== parsed.data.refreshToken) {
      res.status(401).json({ error: "Invalid refresh token" });
      return;
    }

    const user = users[0];
    const newPayload = { userId: user.id, tenantId: user.tenantId, role: user.role, email: user.email };
    const accessToken = signAccessToken(newPayload);
    const newRefreshToken = signRefreshToken(newPayload);

    await db.update(usersTable).set({ refreshToken: newRefreshToken }).where(eq(usersTable.id, user.id));

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

router.post("/auth/logout", authenticate, async (req, res): Promise<void> => {
  const user = (req as any).user;
  await db.update(usersTable).set({ refreshToken: null }).where(eq(usersTable.id, user.userId));
  res.json({ message: "Logged out" });
});

router.get("/auth/me", authenticate, async (req, res): Promise<void> => {
  const { userId } = (req as any).user;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!users.length) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(safeUser(users[0]));
});

export default router;
