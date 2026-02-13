import { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      organizationId: number;
      user: {
        id?: number;
        email?: string;
        role: string;
      };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const skipAuth = process.env.SKIP_AUTH === "true" || process.env.NODE_ENV !== "production";

  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      // TODO: validate JWT token and extract org/user when real auth is added
    } catch (error) {
      return res.status(401).json({ error: "Unauthorized - Invalid token" });
    }
  }

  if (skipAuth) {
    req.organizationId = req.organizationId || 1;
    req.user = req.user || {
      id: 1,
      email: "admin@dvele.com",
      role: "admin",
    };
    return next();
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized - No token provided" });
  }

  req.organizationId = req.organizationId || 1;
  req.user = req.user || {
    id: 1,
    email: "admin@dvele.com",
    role: "admin",
  };
  return next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Forbidden - Admin access required" });
  }
  next();
}
