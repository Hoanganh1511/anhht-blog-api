import { Router } from "express";
import { prisma } from "../lib/prisma";
import { optionalAuth } from "../middleware/auth";

const router = Router();

const POST_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImage: true,
  publishedAt: true,
  _count: { select: { likes: true } },
} as const;

function mergeInteractions(
  posts: { post: (typeof POST_SELECT extends Record<string, unknown> ? any : never) }[],
  likedSet: Set<string>,
  savedSet: Set<string>,
) {
  return posts.map((r) => ({
    ...r,
    post: {
      ...r.post,
      likesCount: r.post._count.likes as number,
      likedByMe: likedSet.has(r.post.id),
      savedByMe: savedSet.has(r.post.id),
    },
  }));
}

// GET /categories — tất cả categories kèm 5 bài mới nhất (cho home page)
router.get("/", optionalAuth, async (req, res) => {
  const userId = req.user?.id ?? null;

  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: {
      posts: {
        where: { post: { status: "PUBLISHED" } },
        orderBy: { post: { publishedAt: "desc" } },
        take: 5,
        include: { post: { select: POST_SELECT } },
      },
    },
  });

  if (!userId) {
    res.json(categories.map((cat) => ({
      ...cat,
      posts: cat.posts.map((r) => ({
        ...r,
        post: { ...r.post, likesCount: r.post._count.likes, likedByMe: false, savedByMe: false },
      })),
    })));
    return;
  }

  const allPostIds = [...new Set(categories.flatMap((cat) => cat.posts.map((r) => r.post.id)))];
  const [likedRows, savedRows] = await Promise.all([
    prisma.postLike.findMany({ where: { userId, postId: { in: allPostIds } }, select: { postId: true } }),
    prisma.savedPost.findMany({ where: { userId, postId: { in: allPostIds } }, select: { postId: true } }),
  ]);
  const likedSet = new Set(likedRows.map((l) => l.postId));
  const savedSet = new Set(savedRows.map((s) => s.postId));

  res.json(categories.map((cat) => ({
    ...cat,
    posts: mergeInteractions(cat.posts, likedSet, savedSet),
  })));
});

// GET /categories/:slug — category + posts phân trang (cho category page)
router.get("/:slug", optionalAuth, async (req, res) => {
  const { slug } = req.params;
  const userId = req.user?.id ?? null;
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
      select: POST_SELECT,
    }),
    prisma.post.count({ where }),
  ]);

  if (!userId) {
    res.json({
      category,
      posts: posts.map((p) => ({ ...p, likesCount: p._count.likes, likedByMe: false, savedByMe: false })),
      total,
      page,
      pageSize,
    });
    return;
  }

  const postIds = posts.map((p) => p.id);
  const [likedRows, savedRows] = await Promise.all([
    prisma.postLike.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } }),
    prisma.savedPost.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } }),
  ]);
  const likedSet = new Set(likedRows.map((l) => l.postId));
  const savedSet = new Set(savedRows.map((s) => s.postId));

  res.json({
    category,
    posts: posts.map((p) => ({
      ...p,
      likesCount: p._count.likes,
      likedByMe: likedSet.has(p.id),
      savedByMe: savedSet.has(p.id),
    })),
    total,
    page,
    pageSize,
  });
});

export default router;
