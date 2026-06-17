"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// DELETE /comments/:id — xoá comment (tác giả hoặc admin)
router.delete("/:id", auth_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    const comment = await prisma_1.prisma.comment.findUnique({ where: { id } });
    if (!comment) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    const isAuthor = comment.userId === req.user.id;
    const isAdmin = req.user.role === "ADMIN";
    if (!isAuthor && !isAdmin) {
        res.status(403).json({ error: "Forbidden" });
        return;
    }
    await prisma_1.prisma.comment.delete({ where: { id } });
    res.status(204).send();
});
exports.default = router;
