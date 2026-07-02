import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

const COMMENT_MAX_LENGTH = 500;

// PATCH /comments/:id — sửa comment (chỉ tác giả)
router.patch("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const content = String(req.body.content ?? "").trim();

  if (!content) {
    res.status(400).json({ error: "Nội dung không được trống" });
    return;
  }
  if (content.length > COMMENT_MAX_LENGTH) {
    res.status(400).json({ error: `Bình luận tối đa ${COMMENT_MAX_LENGTH} ký tự` });
    return;
  }

  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (comment.userId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const updated = await prisma.comment.update({
    where: { id },
    data: { content },
    include: { user: { select: { id: true, name: true, image: true } } },
  });
  res.json(updated);
});

// POST /comments/:id/like — toggle like comment
router.post("/:id/like", requireAuth, async (req, res) => {
  const commentId = req.params.id as string;
  const userId = req.user!.id;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true },
  });
  if (!comment) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const existing = await prisma.commentLike.findUnique({
    where: { commentId_userId: { commentId, userId } },
  });

  if (existing) {
    await prisma.commentLike.delete({ where: { commentId_userId: { commentId, userId } } });
  } else {
    await prisma.commentLike.create({ data: { commentId, userId } });
  }

  const likesCount = await prisma.commentLike.count({ where: { commentId } });
  res.json({ liked: !existing, likesCount });
});

// DELETE /comments/:id — xoá comment (tác giả hoặc admin)
router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const comment = await prisma.comment.findUnique({ where: { id } });

  if (!comment) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const isAuthor = comment.userId === req.user!.id;
  const isAdmin = req.user!.role === "ADMIN";

  if (!isAuthor && !isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await prisma.comment.delete({ where: { id } });
  res.status(204).send();
});

export default router;
