import { Router } from "express";
import { prisma } from "../lib/prisma";
import { createPresignedUpload } from "../lib/s3";
import { requireAuth } from "../middleware/auth";

const router = Router();

// POST /upload — tạo presigned S3 URL
router.post("/", requireAuth, async (req, res) => {
  const { filename, contentType, size } = req.body;

  if (!filename || !contentType || !size) {
    res.status(400).json({ error: "Thiếu thông tin file" });
    return;
  }

  const { uploadUrl, key, publicUrl } = await createPresignedUpload(filename, contentType, size);

  await prisma.media.create({
    data: {
      key,
      url: publicUrl,
      type: contentType,
      size,
      uploadedById: req.user!.id,
    },
  });

  res.json({ uploadUrl, key, publicUrl });
});

export default router;
