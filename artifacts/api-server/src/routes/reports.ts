/**
 * Analytics and reporting endpoints.
 *
 * Optimisation strategy:
 *  - Aggregations are done in-process after fetching filtered data (suitable for
 *    moderate dataset sizes). For high scale, these should be moved to PostgreSQL
 *    aggregate queries or materialized views (see comments inline).
 *  - CSV export is streamed for memory efficiency.
 */

import { Router } from "express";
import { db, purchaseOrdersTable, vendorsTable, auditLogsTable, inventoryTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

const READ_ROLES = ["super_admin", "company_admin", "finance_officer", "auditor"];

// Spending trend by month (last 12 months) — plural alias also supported
router.get(["/reports/spending-trend", "/reports/spending-trends"], authenticate, authorize(...READ_ROLES), async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;

  const pos = await db
    .select()
    .from(purchaseOrdersTable)
    .where(eq(purchaseOrdersTable.tenantId, tenantId));

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const relevant = pos.filter(
    (p) =>
      !["draft", "cancelled"].includes(p.status) &&
      new Date(p.createdAt) >= twelveMonthsAgo,
  );

  const byMonth: Record<string, { month: string; totalSpent: number; orderCount: number }> = {};

  for (const po of relevant) {
    const d = new Date(po.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { month: key, totalSpent: 0, orderCount: 0 };
    byMonth[key].totalSpent += parseFloat(po.totalAmount ?? "0");
    byMonth[key].orderCount += 1;
  }

  const result = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
  res.json(result);
});

// Approval bottleneck analysis — avg time per status transition
router.get("/reports/approval-bottlenecks", authenticate, authorize(...READ_ROLES), async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;

  const pos = await db
    .select()
    .from(purchaseOrdersTable)
    .where(eq(purchaseOrdersTable.tenantId, tenantId));

  const bottlenecks: {
    status: string;
    count: number;
    avgDurationMs: number;
    maxDurationMs: number;
  }[] = [];

  const transitionTimes: Record<string, number[]> = {};

  for (const po of pos) {
    const history = (po.approvalHistory as any[]) ?? [];
    for (let i = 1; i < history.length; i++) {
      const from = history[i - 1];
      const to = history[i];
      const duration = new Date(to.timestamp).getTime() - new Date(from.timestamp).getTime();
      const key = `${from.status}→${to.status}`;
      if (!transitionTimes[key]) transitionTimes[key] = [];
      transitionTimes[key].push(duration);
    }
  }

  for (const [transition, times] of Object.entries(transitionTimes)) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    bottlenecks.push({ status: transition, count: times.length, avgDurationMs: Math.round(avg), maxDurationMs: max });
  }

  bottlenecks.sort((a, b) => b.avgDurationMs - a.avgDurationMs);
  res.json(bottlenecks);
});

// Vendor performance report
router.get("/reports/vendor-performance", authenticate, authorize(...READ_ROLES), async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;

  const vendors = await db.select().from(vendorsTable).where(eq(vendorsTable.tenantId, tenantId));
  const pos = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.tenantId, tenantId));

  const result = vendors.map((vendor) => {
    const vendorPOs = pos.filter((p) => p.vendorId === vendor.id);
    const approved = vendorPOs.filter((p) => p.status === "approved").length;
    const rejected = vendorPOs.filter((p) => p.status === "rejected").length;
    const totalSpent = vendorPOs
      .filter((p) => !["draft", "cancelled"].includes(p.status))
      .reduce((sum, p) => sum + parseFloat(p.totalAmount ?? "0"), 0);

    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      category: vendor.category,
      rating: parseFloat(String(vendor.rating ?? "0")),
      riskScore: vendor.riskScore,
      isBlacklisted: vendor.isBlacklisted,
      totalOrders: vendorPOs.length,
      approvedOrders: approved,
      rejectedOrders: rejected,
      approvalRate: vendorPOs.length > 0 ? Math.round((approved / vendorPOs.length) * 100) : 0,
      totalSpent,
      complianceExpiry: vendor.complianceExpiry,
      complianceStatus:
        !vendor.complianceExpiry
          ? "none"
          : new Date(vendor.complianceExpiry) < new Date()
          ? "expired"
          : new Date(vendor.complianceExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          ? "expiring_soon"
          : "valid",
    };
  });

  result.sort((a, b) => b.totalSpent - a.totalSpent);
  res.json(result);
});

// Inventory movement summary by category
router.get("/reports/inventory-summary", authenticate, authorize(...READ_ROLES), async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;

  const items = await db.select().from(inventoryTable).where(eq(inventoryTable.tenantId, tenantId));

  const byCategory: Record<
    string,
    { category: string; itemCount: number; totalValue: number; lowStockCount: number }
  > = {};

  for (const item of items) {
    const cat = item.category;
    if (!byCategory[cat]) {
      byCategory[cat] = { category: cat, itemCount: 0, totalValue: 0, lowStockCount: 0 };
    }
    const qty = parseFloat(item.quantity ?? "0");
    const cost = parseFloat(item.unitCost ?? "0");
    byCategory[cat].itemCount += 1;
    byCategory[cat].totalValue += qty * cost;
    if (qty <= parseFloat(item.reorderLevel ?? "0")) {
      byCategory[cat].lowStockCount += 1;
    }
  }

  res.json(Object.values(byCategory).sort((a, b) => b.totalValue - a.totalValue));
});

// User activity report
router.get("/reports/user-activity", authenticate, authorize(...READ_ROLES), async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;

  const logs = await db
    .select()
    .from(auditLogsTable)
    .where(eq(auditLogsTable.tenantId, tenantId))
    .orderBy(desc(auditLogsTable.timestamp))
    .limit(5000);

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.tenantId, tenantId));

  const userMap = Object.fromEntries(users.map((u) => [u.id, { name: u.name, role: u.role }]));

  const activityByUser: Record<
    number,
    { userId: number; name: string; role: string; actionCount: number; lastActive: string | null }
  > = {};

  for (const log of logs) {
    const uid = log.userId;
    if (!activityByUser[uid]) {
      activityByUser[uid] = {
        userId: uid,
        name: userMap[uid]?.name ?? log.userName,
        role: userMap[uid]?.role ?? log.userRole,
        actionCount: 0,
        lastActive: null,
      };
    }
    activityByUser[uid].actionCount += 1;
    if (!activityByUser[uid].lastActive) {
      activityByUser[uid].lastActive = new Date(log.timestamp).toISOString();
    }
  }

  const result = Object.values(activityByUser).sort((a, b) => b.actionCount - a.actionCount);
  res.json(result);
});

// Export audit logs as CSV
router.get("/reports/audit-export", authenticate, authorize(...READ_ROLES), async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const entityType = req.query.entityType as string | undefined;

  let logs = await db
    .select()
    .from(auditLogsTable)
    .where(eq(auditLogsTable.tenantId, tenantId))
    .orderBy(desc(auditLogsTable.timestamp))
    .limit(10000);

  if (from) logs = logs.filter((l) => new Date(l.timestamp) >= new Date(from));
  if (to) logs = logs.filter((l) => new Date(l.timestamp) <= new Date(to));
  if (entityType) logs = logs.filter((l) => l.entityType === entityType);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="audit-log-${Date.now()}.csv"`,
  );

  const headers = [
    "id",
    "timestamp",
    "userId",
    "userName",
    "userRole",
    "action",
    "entityType",
    "entityId",
    "ipAddress",
    "correlationId",
  ];
  res.write(headers.join(",") + "\n");

  for (const log of logs) {
    const row = [
      log.id,
      new Date(log.timestamp).toISOString(),
      log.userId,
      `"${log.userName.replace(/"/g, '""')}"`,
      log.userRole,
      log.action,
      log.entityType,
      log.entityId,
      log.ipAddress ?? "",
      log.correlationId ?? "",
    ];
    res.write(row.join(",") + "\n");
  }

  res.end();
});

export default router;
