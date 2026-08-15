import { Client } from "minio";

const endPoint = process.env.MINIO_ENDPOINT ?? "127.0.0.1";
const port = Number(process.env.MINIO_PORT ?? "9000");
const useSSL = process.env.MINIO_USE_SSL === "true";
const accessKey = process.env.MINIO_ACCESS_KEY ?? "setuhire";
const secretKey = process.env.MINIO_SECRET_KEY ?? "setuhire-secret";
const bucket = process.env.MINIO_BUCKET ?? "setuhire";

export const minioClient = new Client({ endPoint, port, useSSL, accessKey, secretKey });

export async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(bucket);
  if (!exists) {
    await minioClient.makeBucket(bucket);
  }
}

export async function putObject(key: string, buffer: Buffer, contentType: string) {
  await ensureBucket();
  return minioClient.putObject(bucket, key, buffer, buffer.byteLength, {
    "Content-Type": contentType,
  });
}

export async function getPresignedUrl(key: string, expires: number = 3600): Promise<string> {
  return minioClient.presignedGetObject(bucket, key, expires);
}
