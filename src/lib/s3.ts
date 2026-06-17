import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Lazy init — đọc process.env khi request đầu tiên đến (sau khi dotenv đã chạy)
let _s3: S3Client | undefined;
function getS3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: process.env.BLOG_S3_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return _s3;
}

function getBucket(): string { return process.env.S3_BUCKET!; }
function getPublicUrl(): string { return process.env.CDN_BASE_URL!.replace(/\/$/, ""); }

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
  const key = `uploads/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(getS3(), command, { expiresIn: 300 });
  const publicUrl = `${getPublicUrl()}/${key}`;

  return { uploadUrl, key, publicUrl };
}

export async function deleteObject(key: string): Promise<void> {
  await getS3().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}
