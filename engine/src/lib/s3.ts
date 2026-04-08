import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "@/config";
import { randomUUID } from "crypto";

let _s3: S3Client | null = null;

function getS3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: config.AWS_REGION,
      credentials:
        config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY
          ? { accessKeyId: config.AWS_ACCESS_KEY_ID, secretAccessKey: config.AWS_SECRET_ACCESS_KEY }
          : undefined,
    });
  }
  return _s3;
}

export function buildS3Key(institutionSlug: string, folder: string, filename: string): string {
  const ext = filename.split(".").pop() ?? "bin";
  return `${institutionSlug}/${folder}/${Date.now()}-${randomUUID()}.${ext}`;
}

export async function uploadToS3(key: string, body: Buffer, mimeType: string): Promise<void> {
  if (!config.S3_BUCKET) throw new Error("S3_BUCKET not configured");
  await getS3().send(new PutObjectCommand({
    Bucket: config.S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: mimeType,
  }));
}

export async function getPresignedDownloadUrl(key: string): Promise<string> {
  if (!config.S3_BUCKET) throw new Error("S3_BUCKET not configured");
  const cmd = new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key });
  return getSignedUrl(getS3(), cmd, { expiresIn: config.S3_URL_EXPIRES_SEC });
}

export async function deleteFromS3(key: string): Promise<void> {
  if (!config.S3_BUCKET) return;
  await getS3().send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: key }));
}

export function isS3Configured(): boolean {
  return !!(config.S3_BUCKET && config.AWS_ACCESS_KEY_ID);
}
