"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// GET /admin/posts — toàn bộ bài (kể cả draft)
router.get("/posts", auth_1.requireAdmin, async (_req, res) => {
    const posts = await prisma_1.prisma.post.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
            categories: { include: { category: true } },
            _count: { select: { likes: true } },
        },
    });
    res.json(posts);
});
exports.default = router;
