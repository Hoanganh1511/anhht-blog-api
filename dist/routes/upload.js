"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const s3_1 = require("../lib/s3");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// POST /upload — tạo presigned S3 URL
router.post("/", auth_1.requireAuth, async (req, res) => {
    const { filename, contentType, size } = req.body;
    if (!filename || !contentType || !size) {
        res.status(400).json({ error: "Thiếu thông tin file" });
        return;
    }
    const { uploadUrl, key, publicUrl } = await (0, s3_1.createPresignedUpload)(filename, contentType, size);
    await prisma_1.prisma.media.create({
        data: {
            key,
            url: publicUrl,
            type: contentType,
            size,
            uploadedById: req.user.id,
        },
    });
    res.json({ uploadUrl, key, publicUrl });
});
exports.default = router;
