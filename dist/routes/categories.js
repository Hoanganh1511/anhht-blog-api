"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
// GET /categories — tất cả categories kèm 5 bài mới nhất (cho home page)
router.get("/", async (_req, res) => {
    const categories = await prisma_1.prisma.category.findMany({
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
    const page = Math.max(1, parseInt(req.query.page ?? "1"));
    const pageSize = 12;
    const category = await prisma_1.prisma.category.findUnique({ where: { slug } });
    if (!category) {
        res.status(404).json({ error: "Not found" });
        return;
    }
    const where = {
        status: "PUBLISHED",
        categories: { some: { categoryId: category.id } },
    };
    const [posts, total] = await Promise.all([
        prisma_1.prisma.post.findMany({
            where,
            orderBy: { publishedAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: { likes: true },
        }),
        prisma_1.prisma.post.count({ where }),
    ]);
    res.json({ category, posts, total, page, pageSize });
});
exports.default = router;
