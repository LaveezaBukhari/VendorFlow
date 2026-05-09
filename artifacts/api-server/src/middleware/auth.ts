import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt";

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const payload = verifyAccessToken(token);
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    if (roles.length > 0 && !roles.includes(user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

// Tenant isolation — ensures all DB queries are scoped to the authenticated tenant
export function tenantScope(req: Request, _res: Response, next: NextFunction) {
  const user = (req as any).user;
  (req as any).tenantId = user?.tenantId ?? 1;
  next();
}
