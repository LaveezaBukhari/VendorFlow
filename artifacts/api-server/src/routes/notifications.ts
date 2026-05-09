import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/notifications", authenticate, async (req, res) => {
  const user = (req as any).user;
  const notifications = await db.select().from(notificationsTable)
    .where(and(eq(notificationsTable.userId, user.userId), eq(notificationsTable.tenantId, user.tenantId)))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  return res.json(notifications);
});

router.patch("/notifications/:id/read", authenticate, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const [updated] = await db.update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, (req as any).user.userId)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Not found" });
  return res.json(updated);
});

router.delete("/notifications/:id", authenticate, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  await db.delete(notificationsTable)
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, (req as any).user.userId)));
  return res.json({ message: "Notification deleted" });
});

export default router;
