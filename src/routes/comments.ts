import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

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
