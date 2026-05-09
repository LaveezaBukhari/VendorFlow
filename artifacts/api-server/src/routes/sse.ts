/**
 * Server-Sent Events (SSE) endpoint for real-time updates.
 *
 * SSE is chosen over WebSockets because:
 * - Unidirectional (server → client) fits the use case (approval updates, notifications)
 * - Built-in browser reconnection via EventSource API
 * - Works over HTTP/1.1 without protocol upgrade — simpler infra / proxy-friendly
 * - Native support in all modern browsers without libraries
 *
 * For bidirectional needs (e.g. collaborative editing cursors) WebSockets would be preferred.
 */

import { Router } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { logger } from "../lib/logger";

const router = Router();

// In-memory registry: tenantId → Set of SSE response objects
const tenantClients = new Map<number, Set<{ res: any; userId: number }>>();

/**
 * Publish an event to all connected clients of a tenant.
 * Call this from any route handler after a state-changing operation.
 */
export function publishToTenant(
  tenantId: number,
  event: { type: string; data: unknown; userId?: number },
) {
  const clients = tenantClients.get(tenantId);
  if (!clients || clients.size === 0) return;

  const payload = JSON.stringify(event.data);

  for (const client of clients) {
    // Optionally send targeted events (skip sender or target specific user)
    try {
      client.res.write(`event: ${event.type}\n`);
      client.res.write(`data: ${payload}\n\n`);
    } catch {
      // Client disconnected mid-write; cleanup happens in the 'close' handler
    }
  }
}

/**
 * GET /api/v1/sse
 *
 * Clients connect with their JWT as a query parameter:
 *   EventSource('/api/v1/sse?token=<accessToken>')
 *
 * Events emitted:
 *   - `connected`           — initial handshake
 *   - `po_submitted`        — new PO awaiting approval
 *   - `po_approved`         — PO approved
 *   - `po_rejected`         — PO rejected
 *   - `po_received`         — PO goods received
 *   - `notification`        — generic notification
 *   - `inventory_low`       — item below reorder level
 *   - `compliance_expiring` — vendor compliance expiry alert
 *   - `heartbeat`           — keep-alive ping every 30s
 */
router.get("/sse", (req, res): void => {
  // Authenticate via query param (EventSource cannot set headers)
  const token = req.query.token as string;
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  let user: any;
  try {
    user = verifyAccessToken(token);
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable Nginx buffering
  res.flushHeaders();

  const clientEntry = { res, userId: user.userId };
  const tenantId = user.tenantId;

  if (!tenantClients.has(tenantId)) {
    tenantClients.set(tenantId, new Set());
  }
  tenantClients.get(tenantId)!.add(clientEntry);

  logger.info({ tenantId, userId: user.userId }, "SSE client connected");

  // Send initial handshake
  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify({ userId: user.userId, tenantId, timestamp: new Date().toISOString() })}\n\n`);

  // Heartbeat every 30s to prevent proxy timeouts
  const heartbeat = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 30_000);

  // Cleanup on disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    tenantClients.get(tenantId)?.delete(clientEntry);
    if (tenantClients.get(tenantId)?.size === 0) {
      tenantClients.delete(tenantId);
    }
    logger.info({ tenantId, userId: user.userId }, "SSE client disconnected");
  });
});

export default router;
