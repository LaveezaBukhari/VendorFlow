import { db, auditLogsTable } from "@workspace/db";
import type { Request } from "express";

interface AuditParams {
  req: Request;
  action: string;
  entityType: string;
  entityId: string | number;
  before?: object | null;
  after?: object | null;
  changes?: object;
}

export async function writeAudit({ req, action, entityType, entityId, before, after, changes }: AuditParams) {
  const user = (req as any).user;
  const correlationId = req.headers["x-correlation-id"] as string || undefined;
  try {
    await db.insert(auditLogsTable).values({
      tenantId: user?.tenantId ?? 1,
      userId: user?.userId ?? 1,
      userName: user?.email ?? "system",
      userRole: user?.role ?? "unknown",
      action,
      entityType,
      entityId: String(entityId),
      before: before ?? null,
      after: after ?? null,
      changes: changes ?? {},
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      correlationId,
    });
  } catch {
    // audit failures must never break business logic
  }
}
