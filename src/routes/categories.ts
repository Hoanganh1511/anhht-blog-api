import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /categories — tất cả categories kèm 5 bài mới nhất (cho home page)
router.get("/", async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: {
      posts: {
        where: { post: { status: "PUBLISHED" } },
        orderBy: { post: { publishedAt: "desc" } },
        take: 5,
        include: {
          post: { include: { likes: true } },
        },
      },
    },
  });
  res.json(categories);
});

// GET /categories/:slug — category + posts phân trang (cho category page)
router.get("/:slug", async (req, res) => {
  const { slug } = req.params;
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1"));
  const pageSize = 12;

  const category = await prisma.category.findUnique({
    where: { slug },
    include: { parent: true },
  });
  if (!category) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const where = {
    status: "PUBLISHED" as const,
    categories: { some: { categoryId: category.id } },
  };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { likes: true },
    }),
    prisma.post.count({ where }),
  ]);

  res.json({ category, posts, total, page, pageSize });
});

export default router;
