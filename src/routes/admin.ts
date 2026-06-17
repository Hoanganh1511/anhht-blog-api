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

// GET /admin/posts/:id — chi tiết bài (kể cả draft)
router.get("/posts/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const post = await prisma.post.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });
  if (!post) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(post);
});

export default router;
