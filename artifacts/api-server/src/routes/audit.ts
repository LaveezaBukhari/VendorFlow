import { Router } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { authenticate, authorize } from "../middleware/auth";
import { getPagination, paginate } from "../lib/pagination";

const router = Router();

router.get("/audit", authenticate, authorize("super_admin", "company_admin", "auditor", "finance_officer"), async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const { page, limit } = getPagination(req);
  const entityType = req.query.entityType as string;
  const action = req.query.action as string;
  const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
  const from = req.query.from as string;
  const to = req.query.to as string;

  let all = await db.select().from(auditLogsTable)
    .where(eq(auditLogsTable.tenantId, tenantId))
    .orderBy(desc(auditLogsTable.timestamp))
    .limit(1000);

  if (entityType) all = all.filter((l) => l.entityType === entityType);
  if (action) all = all.filter((l) => l.action === action);
  if (userId) all = all.filter((l) => l.userId === userId);
  if (from) all = all.filter((l) => new Date(l.timestamp) >= new Date(from));
  if (to) all = all.filter((l) => new Date(l.timestamp) <= new Date(to));

  const total = all.length;
  const paged = all.slice((page - 1) * limit, page * limit);

  res.json({ data: paged, total, page, limit, totalPages: Math.ceil(total / limit) });
});

export default router;
