import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/auth";

const router = Router();

// GET /admin/stats — thống kê dashboard
router.get("/stats", requireAdmin, async (_req, res) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  const dow = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - (dow === 0 ? 6 : dow - 1));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(startOfToday);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

  const [total, published, draft, thisMonth, thisWeek, today, recentPosts] =
    await Promise.all([
      prisma.post.count(),
      prisma.post.count({ where: { status: "PUBLISHED" } }),
      prisma.post.count({ where: { status: "DRAFT" } }),
      prisma.post.count({ where: { status: "PUBLISHED", publishedAt: { gte: startOfMonth } } }),
      prisma.post.count({ where: { status: "PUBLISHED", publishedAt: { gte: startOfWeek } } }),
      prisma.post.count({ where: { status: "PUBLISHED", publishedAt: { gte: startOfToday } } }),
      prisma.post.findMany({
        where: { publishedAt: { gte: thirtyDaysAgo } },
        select: { id: true, title: true, slug: true, status: true, publishedAt: true },
        orderBy: { publishedAt: "desc" },
      }),
    ]);

  const byDate = new Map<string, { count: number; posts: object[] }>();
  for (const post of recentPosts) {
    if (!post.publishedAt) continue;
    const key = post.publishedAt.toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, { count: 0, posts: [] });
    const entry = byDate.get(key)!;
    entry.count++;
    entry.posts.push({ id: post.id, title: post.title, slug: post.slug, status: post.status });
  }

  const daily = Array.from(byDate.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, data]) => ({ date, ...data }));

  res.json({ total, published, draft, thisMonth, thisWeek, today, daily });
});

// GET /admin/categories — cây danh mục kèm số bài viết
router.get("/categories", requireAdmin, async (_req, res) => {
  const parents = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { order: "asc" },
    include: {
      _count: { select: { posts: true } },
      children: {
        orderBy: { order: "asc" },
        include: { _count: { select: { posts: true } } },
      },
    },
  });
  res.json(parents);
});

// PUT /admin/categories/reorder — lưu thứ tự hàng loạt
router.put("/categories/reorder", requireAdmin, async (req, res) => {
  const { items } = req.body as { items: { id: string; order: number }[] };
  await Promise.all(
    items.map(({ id, order }) =>
      prisma.category.update({ where: { id }, data: { order } }),
    ),
  );
  res.json({ ok: true });
});

// POST /admin/categories — tạo danh mục
router.post("/categories", requireAdmin, async (req, res) => {
  const { name, slug, order = 0, parentId } = req.body;
  const category = await prisma.category.create({
    data: { name, slug, order, parentId: parentId || null },
  });
  res.status(201).json(category);
});

// PUT /admin/categories/:id — cập nhật danh mục
router.put("/categories/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, slug, order, parentId } = req.body;
  const category = await prisma.category.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(slug !== undefined && { slug }),
      ...(order !== undefined && { order }),
      ...(parentId !== undefined && { parentId: parentId || null }),
    },
  });
  res.json(category);
});

// DELETE /admin/categories/:id — xóa danh mục (từ chối nếu còn danh mục con)
router.delete("/categories/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const childCount = await prisma.category.count({ where: { parentId: id } });
  if (childCount > 0) {
    res.status(400).json({ error: "Vui lòng xóa hoặc chuyển danh mục con trước." });
    return;
  }
  await prisma.category.delete({ where: { id } });
  res.status(204).end();
});

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

// POST /admin/posts — tạo bài mới
router.post("/posts", requireAdmin, async (req, res) => {
  const {
    title,
    slug,
    excerpt,
    coverImage,
    content,
    status = "DRAFT",
    categoryIds = [],
    tagIds = [],
    metaTitle,
    metaDescription,
    ogImage,
  } = req.body;

  const post = await prisma.post.create({
    data: {
      title,
      slug,
      excerpt,
      coverImage,
      content,
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      metaTitle,
      metaDescription,
      ogImage,
      categories: {
        create: (categoryIds as string[]).map((id) => ({ categoryId: id })),
      },
      tags: {
        create: (tagIds as string[]).map((id) => ({ tagId: id })),
      },
    },
    include: {
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
    },
  });

  res.status(201).json(post);
});

// PUT /admin/posts/:id — cập nhật bài
router.put("/posts/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    title,
    slug,
    excerpt,
    coverImage,
    content,
    status,
    categoryIds,
    tagIds,
    metaTitle,
    metaDescription,
    ogImage,
  } = req.body;

  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const publishedAt =
    status === "PUBLISHED" && existing.status !== "PUBLISHED"
      ? new Date()
      : existing.publishedAt;

  const post = await prisma.post.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(slug !== undefined && { slug }),
      ...(excerpt !== undefined && { excerpt }),
      ...(coverImage !== undefined && { coverImage }),
      ...(content !== undefined && { content }),
      ...(status !== undefined && { status, publishedAt }),
      ...(metaTitle !== undefined && { metaTitle }),
      ...(metaDescription !== undefined && { metaDescription }),
      ...(ogImage !== undefined && { ogImage }),
      ...(categoryIds !== undefined && {
        categories: {
          deleteMany: {},
          create: (categoryIds as string[]).map((cid) => ({ categoryId: cid })),
        },
      }),
      ...(tagIds !== undefined && {
        tags: {
          deleteMany: {},
          create: (tagIds as string[]).map((tid) => ({ tagId: tid })),
        },
      }),
    },
    include: {
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
    },
  });

  res.json(post);
});

// DELETE /admin/posts/:id — xóa bài (cascade xóa categories, tags, comments, likes)
router.delete("/posts/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await prisma.post.delete({ where: { id } });
  res.status(204).end();
});

export default router;
