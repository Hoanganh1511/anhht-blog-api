import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/auth";

const router = Router();

// GET /admin/posts — toàn bộ bài (kể cả draft)
router.get("/posts", requireAdmin, async (_req, res) => {
  const posts = await prisma.post.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      categories: { include: { category: true } },
      _count: { select: { likes: true } },
    },
  });
  res.json(posts);
});

export default router;
