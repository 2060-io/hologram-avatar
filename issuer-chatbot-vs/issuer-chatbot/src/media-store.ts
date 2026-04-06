import * as Minio from "minio";

export interface MediaStoreConfig {
  endpoint: string;
  port: number;
  accessKey: string;
  secretKey: string;
  bucket: string;
  useSSL: boolean;
  publicUrl: string;
}

export function loadMediaStoreConfig(): MediaStoreConfig {
  return {
    endpoint: process.env.MINIO_ENDPOINT || "localhost",
    port: parseInt(process.env.MINIO_PORT || "9000", 10),
    accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
    bucket: process.env.MINIO_BUCKET || "avatar-previews",
    useSSL: process.env.MINIO_USE_SSL === "true",
    publicUrl: process.env.MINIO_PUBLIC_URL || "http://localhost:9000",
  };
}

const PRESIGNED_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

export class MediaStore {
  private client: Minio.Client;
  private bucket: string;
  private publicUrl: string;

  constructor(config: MediaStoreConfig) {
    this.client = new Minio.Client({
      endPoint: config.endpoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });
    this.bucket = config.bucket;
    this.publicUrl = config.publicUrl.replace(/\/+$/, "");
  }

  /**
   * Ensure the bucket exists and has a 24h lifecycle expiry rule.
   */
  async init(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
      console.log(`MinIO: created bucket "${this.bucket}"`);
    }

    // Set lifecycle rule: expire all objects after 1 day
    const lifecycleConfig = {
      Rule: [
        {
          ID: "expire-after-24h",
          Status: "Enabled",
          Expiration: { Days: 1 },
        },
      ],
    };
    await this.client.setBucketLifecycle(this.bucket, lifecycleConfig);
    console.log(`MinIO: lifecycle rule set on "${this.bucket}" (24h expiry)`);
  }

  /**
   * Upload a buffer to MinIO and return a presigned GET URL (24h TTL).
   */
  async upload(
    objectName: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<string> {
    await this.client.putObject(this.bucket, objectName, buffer, buffer.length, {
      "Content-Type": mimeType,
    });

    // Generate presigned URL with the public endpoint
    const url = await this.client.presignedGetObject(
      this.bucket,
      objectName,
      PRESIGNED_EXPIRY_SECONDS
    );

    // Replace internal endpoint with public URL in the presigned path
    // presignedGetObject returns a URL like http://localhost:9000/bucket/obj?X-Amz-...
    // We need to replace the scheme+host+port with the public URL
    const parsed = new URL(url);
    const publicParsed = new URL(this.publicUrl);
    parsed.protocol = publicParsed.protocol;
    parsed.hostname = publicParsed.hostname;
    parsed.port = publicParsed.port;
    return parsed.toString();
  }

  /**
   * Download a file from a URL and return it as a Buffer.
   */
  async downloadFromUrl(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download media from ${url}: ${response.status}`);
    }
    const mimeType = response.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await response.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), mimeType };
  }
}
