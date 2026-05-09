import { Router } from "express";
import { db, vendorsTable, purchaseOrdersTable, inventoryTable, auditLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/dashboard/stats", authenticate, async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;

  const [vendors, pos, inventory] = await Promise.all([
    db.select().from(vendorsTable).where(eq(vendorsTable.tenantId, tenantId)),
    db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.tenantId, tenantId)),
    db.select().from(inventoryTable).where(eq(inventoryTable.tenantId, tenantId)),
  ]);

  const totalVendors = vendors.length;
  const activeVendors = vendors.filter((v) => v.status === "active").length;
  const activeOrders = pos.filter((p) => ["submitted", "draft"].includes(p.status)).length;
  const pendingApprovals = pos.filter((p) => p.status === "submitted").length;
  const totalSpending = pos
    .filter((p) => p.status !== "draft" && p.status !== "cancelled")
    .reduce((sum, p) => sum + parseFloat(p.totalAmount ?? "0"), 0);
  const inventoryValue = inventory.reduce(
    (sum, i) => sum + parseFloat(i.quantity ?? "0") * parseFloat(i.unitCost ?? "0"),
    0,
  );
  const lowStockCount = inventory.filter(
    (i) => parseFloat(i.quantity ?? "0") <= parseFloat(i.reorderLevel ?? "0"),
  ).length;
  const approvedOrders = pos.filter((p) => p.status === "approved").length;
  const rejectedOrders = pos.filter((p) => p.status === "rejected").length;

  res.json({
    totalVendors,
    activeVendors,
    activeOrders,
    pendingApprovals,
    totalSpending,
    inventoryValue,
    lowStockCount,
    approvedOrders,
    rejectedOrders,
    totalOrders: pos.length,
  });
});

router.get("/dashboard/spending-by-vendor", authenticate, async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const [vendors, pos] = await Promise.all([
    db.select().from(vendorsTable).where(eq(vendorsTable.tenantId, tenantId)),
    db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.tenantId, tenantId)),
  ]);

  const spending = vendors.map((vendor) => {
    const vendorPOs = pos.filter(
      (p) => p.vendorId === vendor.id && !["draft", "cancelled"].includes(p.status),
    );
    const totalSpent = vendorPOs.reduce((sum, p) => sum + parseFloat(p.totalAmount ?? "0"), 0);
    return { vendorId: vendor.id, vendorName: vendor.name, totalSpent, orderCount: vendorPOs.length };
  });

  res.json(spending.filter((s) => s.totalSpent > 0).sort((a, b) => b.totalSpent - a.totalSpent));
});

router.get("/dashboard/orders-by-status", authenticate, async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const pos = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.tenantId, tenantId));

  const statusMap: Record<string, number> = {};
  for (const po of pos) statusMap[po.status] = (statusMap[po.status] ?? 0) + 1;

  res.json(Object.entries(statusMap).map(([status, count]) => ({ status, count })));
});

export default router;
