import { Router } from "express";
import { db, workflowRulesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

const ADMIN_ROLES = ["super_admin", "company_admin"];

const stageSchema = z.object({
  name: z.string(),
  approverRoles: z.array(z.string()),
  minAmount: z.number().optional(),
  maxAmount: z.number().optional(),
  timeoutHours: z.number().optional(),
});

const ruleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  minAmount: z.number().min(0).default(0),
  maxAmount: z.number().nullable().optional(),
  stages: z.array(stageSchema).min(1),
  isActive: z.boolean().default(true),
});

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

router.get("/workflow-rules", authenticate, async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const rules = await db.select().from(workflowRulesTable).where(eq(workflowRulesTable.tenantId, tenantId));
  res.json(rules);
});

router.post("/workflow-rules", authenticate, authorize(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const parsed = ruleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const [rule] = await db.insert(workflowRulesTable).values({
    tenantId,
    ...parsed.data,
    minAmount: String(parsed.data.minAmount),
    maxAmount: parsed.data.maxAmount ? String(parsed.data.maxAmount) : null,
  }).returning();

  res.status(201).json(rule);
});

router.patch("/workflow-rules/:id", authenticate, authorize(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = ruleSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const updateData: any = { ...parsed.data };
  if (parsed.data.minAmount !== undefined) updateData.minAmount = String(parsed.data.minAmount);
  if (parsed.data.maxAmount !== undefined) updateData.maxAmount = parsed.data.maxAmount ? String(parsed.data.maxAmount) : null;

  const [updated] = await db.update(workflowRulesTable).set(updateData)
    .where(and(eq(workflowRulesTable.id, id), eq(workflowRulesTable.tenantId, tenantId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/workflow-rules/:id", authenticate, authorize(...ADMIN_ROLES), async (req, res): Promise<void> => {
  const tenantId = (req as any).user.tenantId;
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  await db.delete(workflowRulesTable)
    .where(and(eq(workflowRulesTable.id, id), eq(workflowRulesTable.tenantId, tenantId)));
  res.json({ message: "Workflow rule deleted" });
});

export default router;
