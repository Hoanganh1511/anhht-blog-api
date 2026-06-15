import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "auto",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET!;
const PUBLIC_URL = process.env.S3_PUBLIC_URL!;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export type PresignedUploadResult = {
  uploadUrl: string;
  key: string;
  publicUrl: string;
};

export async function createPresignedUpload(
  filename: string,
  contentType: string,
  size: number
): Promise<PresignedUploadResult> {
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new Error("Định dạng ảnh không được hỗ trợ (jpg, png, webp, gif)");
  }
  if (size > MAX_SIZE_BYTES) {
    throw new Error("File vượt quá 5MB");
  }

  const ext = filename.split(".").pop() ?? "bin";
  const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  const publicUrl = `${PUBLIC_URL}/${key}`;

  return { uploadUrl, key, publicUrl };
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
