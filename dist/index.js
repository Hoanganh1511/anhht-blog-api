"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const posts_1 = __importDefault(require("./routes/posts"));
const categories_1 = __importDefault(require("./routes/categories"));
const comments_1 = __importDefault(require("./routes/comments"));
const upload_1 = __importDefault(require("./routes/upload"));
const admin_1 = __importDefault(require("./routes/admin"));
const auth_1 = require("./routes/auth");
const error_1 = require("./middleware/error");
const app = (0, express_1.default)();
const PORT = process.env.PORT ?? 4000;
// CORS: cho phép Next.js frontend gửi cookie
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// Auth (phải trước các route khác, không cần cookieParser vì ExpressAuth tự xử lý)
app.use("/auth/*splat", auth_1.authHandler);
// Routes
app.use("/posts", posts_1.default);
app.use("/categories", categories_1.default);
app.use("/comments", comments_1.default);
app.use("/upload", upload_1.default);
app.use("/admin", admin_1.default);
// Logout — xóa cookie session
app.post("/logout", (_req, res) => {
    const cookieName = process.env.NODE_ENV === "production"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token";
    res.clearCookie(cookieName, { path: "/" });
    res.json({ success: true });
});
// Health check
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
// Error handler (phải đặt cuối cùng)
app.use(error_1.errorHandler);
app.listen(PORT, () => {
    console.log(`Express API running on http://localhost:${PORT}`);
});
