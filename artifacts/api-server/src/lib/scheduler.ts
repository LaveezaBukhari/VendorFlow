/**
 * Background job scheduler.
 *
 * Runs lightweight recurring tasks without an external queue for simplicity.
 * For production scale, these would move to a proper queue (Bull/BullMQ + Redis)
 * with retry policies, dead-letter queues, and distributed locking.
 *
 * Current jobs:
 *  1. Vendor compliance expiry alerts  (daily at midnight UTC)
 *  2. Purchase order escalation        (every hour — flags overdue approvals)
 *  3. Invoice overdue marking          (daily)
 *  4. Low stock alerts                 (every 6 hours)
 */

import { db, vendorsTable, purchaseOrdersTable, notificationsTable, usersTable, invoicesTable } from "@workspace/db";
import { eq, and, lt, lte } from "drizzle-orm";
import { logger } from "./logger";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

// --- Job: vendor compliance expiry alerts ---
async function checkVendorCompliance() {
  logger.info("scheduler: running vendor compliance check");
  try {
    const thirtyDaysFromNow = new Date(Date.now() + 30 * DAY_MS);
    const now = new Date();

    const vendors = await db.select().from(vendorsTable);
    const expiringSoon = vendors.filter(
      (v) =>
        v.complianceExpiry &&
        new Date(v.complianceExpiry) > now &&
        new Date(v.complianceExpiry) <= thirtyDaysFromNow,
    );
    const expired = vendors.filter(
      (v) => v.complianceExpiry && new Date(v.complianceExpiry) <= now,
    );

    for (const vendor of expiringSoon) {
      const admins = await db
        .select()
        .from(usersTable)
        .where(
          and(
            eq(usersTable.tenantId, vendor.tenantId),
            eq(usersTable.isActive, true),
          ),
        );

      const targetAdmins = admins.filter((u) =>
        ["company_admin", "super_admin", "procurement_officer"].includes(u.role),
      );

      for (const admin of targetAdmins) {
        await db.insert(notificationsTable).values({
          tenantId: vendor.tenantId,
          userId: admin.id,
          type: "compliance_expiring",
          title: "Vendor Compliance Expiring Soon",
          message: `${vendor.name}'s compliance documents expire on ${new Date(vendor.complianceExpiry!).toLocaleDateString()}. Please renew before the deadline.`,
          relatedEntityId: String(vendor.id),
          relatedEntityType: "Vendor",
        }).onConflictDoNothing();
      }
    }

    for (const vendor of expired) {
      const admins = await db
        .select()
        .from(usersTable)
        .where(
          and(
            eq(usersTable.tenantId, vendor.tenantId),
            eq(usersTable.isActive, true),
          ),
        );

      const targetAdmins = admins.filter((u) =>
        ["company_admin", "super_admin"].includes(u.role),
      );

      for (const admin of targetAdmins) {
        await db.insert(notificationsTable).values({
          tenantId: vendor.tenantId,
          userId: admin.id,
          type: "compliance_expired",
          title: "Vendor Compliance Expired",
          message: `${vendor.name}'s compliance documents have expired. Immediate action required.`,
          relatedEntityId: String(vendor.id),
          relatedEntityType: "Vendor",
        }).onConflictDoNothing();
      }
    }

    logger.info(
      { expiringSoon: expiringSoon.length, expired: expired.length },
      "scheduler: compliance check complete",
    );
  } catch (err) {
    logger.error({ err }, "scheduler: compliance check failed");
  }
}

// --- Job: escalate overdue purchase orders ---
async function escalateOverduePOs() {
  logger.info("scheduler: running PO escalation check");
  try {
    const now = new Date();

    const submittedPOs = await db
      .select()
      .from(purchaseOrdersTable)
      .where(eq(purchaseOrdersTable.status, "submitted"));

    for (const po of submittedPOs) {
      const submittedEntry = (po.approvalHistory as any[])?.find(
        (h: any) => h.status === "submitted",
      );
      if (!submittedEntry) continue;

      const submittedAt = new Date(submittedEntry.timestamp);
      const hoursSinceSubmission = (now.getTime() - submittedAt.getTime()) / HOUR_MS;

      // Escalate if pending for more than 48 hours
      if (hoursSinceSubmission >= 48) {
        const admins = await db
          .select()
          .from(usersTable)
          .where(
            and(
              eq(usersTable.tenantId, po.tenantId),
              eq(usersTable.isActive, true),
            ),
          );

        const approvers = admins.filter((u) =>
          ["company_admin", "super_admin", "finance_officer"].includes(u.role),
        );

        for (const approver of approvers) {
          await db.insert(notificationsTable).values({
            tenantId: po.tenantId,
            userId: approver.id,
            type: "po_escalation",
            title: "Purchase Order Requires Urgent Attention",
            message: `${po.poNumber} has been awaiting approval for over ${Math.floor(hoursSinceSubmission)} hours. Please review.`,
            relatedEntityId: String(po.id),
            relatedEntityType: "PurchaseOrder",
          }).onConflictDoNothing();
        }
      }
    }

    logger.info({ checked: submittedPOs.length }, "scheduler: PO escalation complete");
  } catch (err) {
    logger.error({ err }, "scheduler: PO escalation failed");
  }
}

// --- Job: mark overdue invoices ---
async function markOverdueInvoices() {
  logger.info("scheduler: running invoice overdue check");
  try {
    const now = new Date();
    const issued = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.status, "issued"));

    const overdue = issued.filter((inv) => new Date(inv.dueDate) < now);

    for (const inv of overdue) {
      await db
        .update(invoicesTable)
        .set({ status: "overdue" })
        .where(eq(invoicesTable.id, inv.id));
    }

    if (overdue.length > 0) {
      logger.info({ count: overdue.length }, "scheduler: invoices marked overdue");
    }
  } catch (err) {
    logger.error({ err }, "scheduler: invoice overdue check failed");
  }
}

// --- Job: low stock alerts ---
async function checkLowStock() {
  logger.info("scheduler: running low stock check");
  try {
    const { inventoryTable } = await import("@workspace/db");
    const items = await db.select().from(inventoryTable);

    const lowStockItems = items.filter(
      (i) => parseFloat(i.quantity ?? "0") <= parseFloat(i.reorderLevel ?? "0"),
    );

    if (lowStockItems.length === 0) return;

    // Group by tenant
    const byTenant: Record<number, typeof lowStockItems> = {};
    for (const item of lowStockItems) {
      if (!byTenant[item.tenantId]) byTenant[item.tenantId] = [];
      byTenant[item.tenantId].push(item);
    }

    for (const [tenantIdStr, tenantItems] of Object.entries(byTenant)) {
      const tenantId = parseInt(tenantIdStr);
      const managers = await db
        .select()
        .from(usersTable)
        .where(
          and(eq(usersTable.tenantId, tenantId), eq(usersTable.isActive, true)),
        );

      const targets = managers.filter((u) =>
        ["company_admin", "super_admin", "inventory_manager"].includes(u.role),
      );

      for (const manager of targets) {
        await db.insert(notificationsTable).values({
          tenantId,
          userId: manager.id,
          type: "inventory_low",
          title: `${tenantItems.length} Item${tenantItems.length > 1 ? "s" : ""} Below Reorder Level`,
          message: `Low stock items: ${tenantItems
            .slice(0, 5)
            .map((i) => i.name)
            .join(", ")}${tenantItems.length > 5 ? ` and ${tenantItems.length - 5} more` : ""}.`,
          relatedEntityId: String(tenantItems[0].id),
          relatedEntityType: "InventoryItem",
        }).onConflictDoNothing();
      }
    }

    logger.info({ count: lowStockItems.length }, "scheduler: low stock check complete");
  } catch (err) {
    logger.error({ err }, "scheduler: low stock check failed");
  }
}

// --- Scheduler bootstrap ---
let schedulerStarted = false;

export function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  logger.info("scheduler: starting background jobs");

  // Run compliance check once at startup, then daily
  setTimeout(() => {
    checkVendorCompliance();
    setInterval(checkVendorCompliance, DAY_MS);
  }, 5_000);

  // Run PO escalation every hour
  setInterval(escalateOverduePOs, HOUR_MS);

  // Run invoice overdue check daily
  setTimeout(() => {
    markOverdueInvoices();
    setInterval(markOverdueInvoices, DAY_MS);
  }, 10_000);

  // Run low stock check every 6 hours
  setTimeout(() => {
    checkLowStock();
    setInterval(checkLowStock, 6 * HOUR_MS);
  }, 15_000);
}
