import { Router } from "express";
import { decode, encode } from "@auth/core/jwt";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

const router = Router();

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  bio: true,
  role: true,
  createdAt: true,
} as const;

// GET /users/author — public profile of the blog owner (first ADMIN)
router.get("/author", async (_req, res) => {
  const user = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { name: true, image: true, bio: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(user ?? { name: null, image: null, bio: null });
});

// GET /users/me — thông tin tài khoản hiện tại
router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: USER_SELECT,
  });
  if (!user) {
    res.status(404).json({ error: "Không tìm thấy người dùng" });
    return;
  }
  res.json(user);
});

// PATCH /users/me — cập nhật tên, avatar và bio
router.patch("/me", requireAuth, async (req, res) => {
  const { name, image, bio } = req.body as { name?: string; image?: string; bio?: string };

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      ...(name !== undefined && { name: name.trim() || null }),
      ...(image !== undefined && { image: image.trim() || null }),
      ...(bio !== undefined && { bio: bio.trim() || null }),
    },
    select: USER_SELECT,
  });
  res.json(user);
});

// POST /users/me/refresh-session — re-encode JWT với data mới từ DB
router.post("/me/refresh-session", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, name: true, email: true, image: true, role: true },
  });
  if (!user) {
    res.status(404).json({ error: "Không tìm thấy người dùng" });
    return;
  }

  // Decode token cũ để giữ nguyên các field như iat, exp, sub...
  const oldToken = req.cookies[COOKIE_NAME];
  const payload = await decode({
    token: oldToken,
    secret: process.env.AUTH_SECRET!,
    salt: COOKIE_NAME,
  });

  if (!payload) {
    res.status(401).json({ error: "Phiên không hợp lệ" });
    return;
  }

  // Tạo JWT mới với name/image đã cập nhật
  const newToken = await encode({
    token: {
      ...payload,
      name: user.name,
      picture: user.image,
      email: user.email,
    },
    secret: process.env.AUTH_SECRET!,
    salt: COOKIE_NAME,
  });

  const isProd = process.env.NODE_ENV === "production";
  res.cookie(COOKIE_NAME, newToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày
  });

  res.json({ ok: true });
});

export default router;
