import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/notifications", authenticate, async (req, res): Promise<void> => {
  const user = (req as any).user;
  const unreadOnly = req.query.unread === "true";

  let notifications = await db
    .select()
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, user.userId), eq(notificationsTable.tenantId, user.tenantId)))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(100);

  if (unreadOnly) notifications = notifications.filter((n) => !n.read);

  const unreadCount = notifications.filter((n) => !n.read).length;
  res.json({ notifications, unreadCount });
});

// Mark all notifications as read for the current user
router.patch("/notifications/read-all", authenticate, async (req, res): Promise<void> => {
  const user = (req as any).user;

  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.userId, user.userId), eq(notificationsTable.tenantId, user.tenantId)));

  res.json({ message: "All notifications marked as read" });
});

router.patch("/notifications/:id/read", authenticate, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [updated] = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, (req as any).user.userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(updated);
});

router.delete("/notifications/:id", authenticate, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  await db
    .delete(notificationsTable)
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, (req as any).user.userId)));
  res.json({ message: "Notification deleted" });
});

// Delete all read notifications for the current user
router.delete("/notifications", authenticate, async (req, res): Promise<void> => {
  const user = (req as any).user;

  await db
    .delete(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, user.userId),
        eq(notificationsTable.tenantId, user.tenantId),
        eq(notificationsTable.read, true),
      ),
    );
  res.json({ message: "Read notifications cleared" });
});

export default router;
