import * as Minio from "minio";
import { createDecipheriv } from "crypto";

export interface CipheringInfo {
  algorithm: string;
  parameters?: Record<string, unknown>;
}

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
   * Download a file from a URL. If ciphering info is provided, decrypt the
   * content using the specified algorithm and parameters.
   */
  async downloadFromUrl(
    url: string,
    ciphering?: CipheringInfo
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download media from ${url}: ${response.status}`);
    }
    const mimeType = response.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await response.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    // Diagnostic logging
    const header = buffer.subarray(0, Math.min(32, buffer.length)).toString("hex");
    console.log(
      `downloadFromUrl: size=${buffer.length} content-type=${mimeType} ` +
      `header=${header} ciphering=${JSON.stringify(ciphering)}`
    );

    if (ciphering && ciphering.algorithm) {
      buffer = this.decrypt(buffer, ciphering);
      console.log(`downloadFromUrl: decrypted size=${buffer.length}`);
    }

    return { buffer, mimeType };
  }

  /**
   * Decrypt a buffer using the ciphering info from the media-sharing protocol.
   * Supports AES-256-GCM (and AES-256-CBC as fallback).
   */
  private decrypt(data: Buffer, ciphering: CipheringInfo): Buffer<ArrayBuffer> {
    const algo = ciphering.algorithm.toUpperCase();
    const params = ciphering.parameters || {};

    // Extract key and IV — they may be hex or base64 encoded
    const keyRaw = params.key as string | undefined;
    const ivRaw = (params.iv ?? params.nonce) as string | undefined;

    if (!keyRaw || !ivRaw) {
      throw new Error(
        `Ciphering parameters missing key or iv/nonce. ` +
        `Algorithm: ${algo}, params: ${JSON.stringify(params)}`
      );
    }

    const key = this.decodeParam(keyRaw);
    const iv = this.decodeParam(ivRaw);

    if (algo.includes("GCM") || algo === "AES-GCM" || algo === "AES-256-GCM") {
      // AES-GCM: last 16 bytes of data are the auth tag
      const tagLength = 16;
      if (data.length < tagLength) {
        throw new Error(`Encrypted data too short for GCM auth tag (${data.length} bytes)`);
      }
      const authTag = data.subarray(data.length - tagLength);
      const ciphertext = data.subarray(0, data.length - tagLength);

      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } else if (algo.includes("CBC") || algo === "AES-CBC" || algo === "AES-256-CBC") {
      const decipher = createDecipheriv("aes-256-cbc", key, iv);
      return Buffer.concat([decipher.update(data), decipher.final()]);
    } else {
      throw new Error(`Unsupported ciphering algorithm: ${algo}`);
    }
  }

  /**
   * Decode a parameter that may be hex or base64 encoded.
   */
  private decodeParam(value: string): Buffer {
    // If it looks like hex (only hex chars, even length), decode as hex
    if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) {
      return Buffer.from(value, "hex");
    }
    // Otherwise try base64
    return Buffer.from(value, "base64");
  }
}
