import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireAdmin, optionalAuth } from "../middleware/auth";

const router = Router();

// GET /posts
router.get("/", async (req, res) => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1"));
  const pageSize = 10;
  const categorySlug = req.query.category as string | undefined;

  const where = {
    status: "PUBLISHED" as const,
    ...(categorySlug && {
      categories: { some: { category: { slug: categorySlug } } },
    }),
  };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        coverImage: true,
        publishedAt: true,
        viewCount: true,
        shareCount: true,
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
        _count: { select: { likes: true } },
      },
    }),
    prisma.post.count({ where }),
  ]);

  res.json({ posts, total, page, pageSize });
});

// POST /posts — tạo bài mới (admin)
router.post("/", requireAdmin, async (req, res) => {
  const body = req.body;
  const categoryIds: string[] = body.categoryIds ?? [];
  const post = await prisma.post.create({
    data: {
      title: body.title,
      slug: body.slug,
      excerpt: body.excerpt,
      content: body.content ?? {},
      coverImage: body.coverImage,
      status: body.status ?? "DRAFT",
      featured: body.featured ?? false,
      coverImages: body.coverImages ?? [],
      publishedAt: body.status === "PUBLISHED" ? new Date() : null,
      metaTitle: body.metaTitle,
      metaDescription: body.metaDescription,
      ogImage: body.ogImage,
      ...(categoryIds.length > 0 && {
        categories: { create: categoryIds.map((id) => ({ categoryId: id })) },
      }),
    },
    include: { categories: { include: { category: true } } },
  });
  res.status(201).json(post);
});

// GET /posts/:id — chi tiết bài (by id hoặc slug)
router.get("/:id", optionalAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id ?? null;

  const post = await prisma.post.findFirst({
    where: { OR: [{ id }, { slug: id }], status: "PUBLISHED" },
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

  const [likedByMe, savedByMe] = userId
    ? await Promise.all([
        prisma.postLike.findUnique({ where: { postId_userId: { postId: post.id, userId } } }),
        prisma.savedPost.findUnique({ where: { postId_userId: { postId: post.id, userId } } }),
      ])
    : [null, null];

  res.json({ ...post, likedByMe: !!likedByMe, savedByMe: !!savedByMe });
});

// PATCH /posts/:id — cập nhật bài (admin)
router.patch("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const body = req.body;
  const categoryIds: string[] | undefined = body.categoryIds;

  const [post] = await prisma.$transaction([
    prisma.post.update({
      where: { id },
      data: {
        ...(body.title && { title: body.title }),
        ...(body.slug && { slug: body.slug }),
        ...(body.excerpt !== undefined && { excerpt: body.excerpt }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.coverImage !== undefined && { coverImage: body.coverImage }),
        ...(body.status && {
          status: body.status,
          publishedAt: body.status === "PUBLISHED" ? new Date() : undefined,
        }),
        ...(body.featured !== undefined && { featured: body.featured }),
        ...(body.coverImages !== undefined && { coverImages: body.coverImages }),
        ...(body.metaTitle !== undefined && { metaTitle: body.metaTitle }),
        ...(body.metaDescription !== undefined && { metaDescription: body.metaDescription }),
        ...(body.ogImage !== undefined && { ogImage: body.ogImage }),
        ...(categoryIds !== undefined && {
          categories: {
            deleteMany: {},
            create: categoryIds.map((cid) => ({ categoryId: cid })),
          },
        }),
      },
      include: { categories: { include: { category: true } } },
    }),
  ]);
  res.json(post);
});

// DELETE /posts/:id — xoá bài (admin)
router.delete("/:id", requireAdmin, async (req, res) => {
  await prisma.post.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// POST /posts/:id/like — toggle like
router.post("/:id/like", requireAuth, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user!.id;

  const existing = await prisma.postLike.findUnique({
    where: { postId_userId: { postId, userId } },
  });

  if (existing) {
    await prisma.postLike.delete({ where: { postId_userId: { postId, userId } } });
  } else {
    await prisma.postLike.create({ data: { postId, userId } });
  }

  const likesCount = await prisma.postLike.count({ where: { postId } });
  res.json({ liked: !existing, likesCount });
});

// POST /posts/:id/save — toggle save
router.post("/:id/save", requireAuth, async (req, res) => {
  const postId = req.params.id as string;
  const userId = req.user!.id as string;

  const existing = await prisma.savedPost.findUnique({
    where: { postId_userId: { postId, userId } },
  });

  if (existing) {
    await prisma.savedPost.delete({ where: { postId_userId: { postId, userId } } });
  } else {
    await prisma.savedPost.create({ data: { postId, userId } });
  }

  res.json({ saved: !existing });
});

// POST /posts/:id/view — tăng lượt xem
router.post("/:id/view", async (req, res) => {
  const post = await prisma.post.update({
    where: { id: req.params.id },
    data: { viewCount: { increment: 1 } },
    select: { viewCount: true },
  });
  res.json({ viewCount: post.viewCount });
});

// POST /posts/:id/share — tăng lượt share
router.post("/:id/share", async (req, res) => {
  const post = await prisma.post.update({
    where: { id: req.params.id },
    data: { shareCount: { increment: 1 } },
    select: { shareCount: true },
  });
  res.json({ shareCount: post.shareCount });
});

// ── Comments ──────────────────────────────────────────────

const COMMENT_MAX_LENGTH = 500;
const COMMENT_COOLDOWN_MS = 15_000; // chống spam: 15s giữa 2 bình luận
const COMMENT_PAGE_SIZE = 10;

const commentUserSelect = { select: { id: true, name: true, image: true } };

// Gom likes/_count thành likesCount + likedByMe phẳng cho client
function serializeComment(c: {
  likes?: { userId: string }[];
  _count?: { likes: number };
  replies?: unknown[];
  [key: string]: unknown;
}): Record<string, unknown> {
  const { likes, _count, replies, ...rest } = c;
  return {
    ...rest,
    likesCount: _count?.likes ?? 0,
    likedByMe: (likes?.length ?? 0) > 0,
    ...(replies !== undefined && {
      replies: (replies as Parameters<typeof serializeComment>[0][]).map(serializeComment),
    }),
  };
}

// GET /posts/:id/comments — danh sách comment, cursor pagination, mới nhất trước
router.get("/:id/comments", optionalAuth, async (req, res) => {
  const postId = req.params.id as string;
  const userId = req.user?.id;
  const cursor = req.query.cursor as string | undefined;

  const commentInclude = {
    user: commentUserSelect,
    _count: { select: { likes: true } },
    ...(userId && { likes: { where: { userId }, select: { userId: true } } }),
  };

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where: { postId, parentId: null },
      orderBy: { createdAt: "desc" },
      take: COMMENT_PAGE_SIZE + 1, // lấy dư 1 để biết còn trang sau không
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      include: {
        ...commentInclude,
        replies: { orderBy: { createdAt: "asc" }, include: commentInclude },
      },
    }),
    prisma.comment.count({ where: { postId } }),
  ]);

  const hasMore = comments.length > COMMENT_PAGE_SIZE;
  const page = hasMore ? comments.slice(0, COMMENT_PAGE_SIZE) : comments;

  res.json({
    comments: page.map(serializeComment),
    total,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
});

// POST /posts/:id/comments — tạo comment
router.post("/:id/comments", requireAuth, async (req, res) => {
  const postId = req.params.id as string;
  const userId = req.user!.id;
  const content = String(req.body.content ?? "").trim();

  if (!content) {
    res.status(400).json({ error: "Nội dung không được trống" });
    return;
  }
  if (content.length > COMMENT_MAX_LENGTH) {
    res.status(400).json({ error: `Bình luận tối đa ${COMMENT_MAX_LENGTH} ký tự` });
    return;
  }

  const recentComment = await prisma.comment.findFirst({
    where: {
      userId,
      createdAt: { gt: new Date(Date.now() - COMMENT_COOLDOWN_MS) },
    },
    select: { id: true },
  });
  if (recentComment) {
    res.status(429).json({ error: "Bạn bình luận quá nhanh, vui lòng thử lại sau vài giây" });
    return;
  }

  // Reply tối đa 1 cấp: reply-của-reply gắn về comment gốc
  let parentId: string | null = null;
  if (req.body.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: req.body.parentId as string },
      select: { id: true, postId: true, parentId: true },
    });
    if (!parent || parent.postId !== postId) {
      res.status(400).json({ error: "Bình luận gốc không tồn tại" });
      return;
    }
    parentId = parent.parentId ?? parent.id;
  }

  const comment = await prisma.comment.create({
    data: { postId, userId, content, parentId, images: req.body.images ?? [] },
    include: {
      user: commentUserSelect,
      _count: { select: { likes: true } },
    },
  });
  res.status(201).json(serializeComment(comment));
});

export default router;
