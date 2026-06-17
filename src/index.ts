import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import postsRouter from "./routes/posts";
import categoriesRouter from "./routes/categories";
import commentsRouter from "./routes/comments";
import uploadRouter from "./routes/upload";
import adminRouter from "./routes/admin";
import { authHandler } from "./routes/auth";
import { errorHandler } from "./middleware/error";

const app = express();
const PORT = process.env.PORT ?? 4000;

app.set("trust proxy", true);

// CORS: cho phép Next.js frontend gửi cookie
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

// Auth (phải trước các route khác, không cần cookieParser vì ExpressAuth tự xử lý)
app.use("/auth", authHandler);

// Routes
app.use("/posts", postsRouter);
app.use("/categories", categoriesRouter);
app.use("/comments", commentsRouter);
app.use("/upload", uploadRouter);
app.use("/admin", adminRouter);

// Logout — xóa cookie session
app.post("/logout", (_req, res) => {
  const cookieName =
    process.env.NODE_ENV === "production"
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
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Express API running on http://localhost:${PORT}`);
});
