import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export function correlationId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers["x-correlation-id"] as string) || randomUUID();
  req.headers["x-correlation-id"] = id;
  res.setHeader("X-Correlation-Id", id);
  next();
}
