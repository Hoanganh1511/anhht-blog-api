"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
exports.optionalAuth = optionalAuth;
const jwt_1 = require("@auth/core/jwt");
// Cookie name khác nhau giữa dev và production
const COOKIE_NAME = process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
// Đọc và verify JWT từ cookie Auth.js
async function getSessionUser(req) {
    const token = req.cookies[COOKIE_NAME];
    if (!token)
        return null;
    try {
        const session = await (0, jwt_1.decode)({
            token,
            secret: process.env.AUTH_SECRET,
            salt: COOKIE_NAME,
        });
        if (!session?.sub && !session?.id)
            return null;
        return {
            id: (session.id ?? session.sub),
            email: session.email,
            role: session.role ?? "USER",
        };
    }
    catch {
        return null;
    }
}
// Middleware: yêu cầu đăng nhập
async function requireAuth(req, res, next) {
    const user = await getSessionUser(req);
    if (!user) {
        res.status(401).json({ error: "Cần đăng nhập" });
        return;
    }
    req.user = user;
    next();
}
// Middleware: yêu cầu quyền ADMIN
async function requireAdmin(req, res, next) {
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
async function optionalAuth(req, _res, next) {
    const user = await getSessionUser(req);
    if (user)
        req.user = user;
    next();
}
