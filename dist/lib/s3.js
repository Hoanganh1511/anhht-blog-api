"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPresignedUpload = createPresignedUpload;
exports.deleteObject = deleteObject;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const s3 = new client_s3_1.S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "auto",
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
    },
    forcePathStyle: true,
});
const BUCKET = process.env.S3_BUCKET;
const PUBLIC_URL = process.env.S3_PUBLIC_URL;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
async function createPresignedUpload(filename, contentType, size) {
    if (!ALLOWED_TYPES.includes(contentType)) {
        throw new Error("Định dạng ảnh không được hỗ trợ (jpg, png, webp, gif)");
    }
    if (size > MAX_SIZE_BYTES) {
        throw new Error("File vượt quá 5MB");
    }
    const ext = filename.split(".").pop() ?? "bin";
    const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const command = new client_s3_1.PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType,
        ContentLength: size,
    });
    const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3, command, { expiresIn: 300 });
    const publicUrl = `${PUBLIC_URL}/${key}`;
    return { uploadUrl, key, publicUrl };
}
async function deleteObject(key) {
    await s3.send(new client_s3_1.DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
