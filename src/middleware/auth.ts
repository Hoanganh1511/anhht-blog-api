import { decode } from "@auth/core/jwt";
import type { Request, Response, NextFunction } from "express";

// Cookie name khác nhau giữa dev và production
const COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

export interface AuthUser {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
}

// Extend Express Request để thêm field user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Đọc và verify JWT từ cookie Auth.js
async function getSessionUser(req: Request): Promise<AuthUser | null> {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return null;

  try {
    const session = await decode({
      token,
      secret: process.env.AUTH_SECRET!,
      salt: COOKIE_NAME,
    });

    if (!session?.sub && !session?.id) return null;

    return {
      id: (session.id ?? session.sub) as string,
      email: session.email as string,
      role: (session.role as "USER" | "ADMIN") ?? "USER",
    };
  } catch {
    return null;
  }
}

// Middleware: yêu cầu đăng nhập
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Cần đăng nhập" });
    return;
  }
  req.user = user;
  next();
}

// Middleware: yêu cầu quyền ADMIN
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Cần đăng nhập" });
    return;
  }
  if (user.role !== "ADMIN") {
    res.status(403).json({ error: "Không có quyền truy cập" });
    return;
  }
  req.user = user;
  next();
}

// Middleware: đăng nhập không bắt buộc (gắn user nếu có)
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const user = await getSessionUser(req);
  if (user) req.user = user;
  next();
}
