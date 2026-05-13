import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

// Lazy import so the app boots without AWS creds
let S3Client: any;
let PutObjectCommand: any;
let GetObjectCommand: any;
let getSignedUrl: any;

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly useS3: boolean;
  private readonly bucket: string;
  private readonly region: string;
  private client: any;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get('S3_BUCKET', '');
    this.region = config.get('S3_REGION', 'us-east-1');
    this.useS3 = !!(this.bucket && config.get('S3_ACCESS_KEY'));
  }

  private async getClient() {
    if (!this.client) {
      const s3Module = await import('@aws-sdk/client-s3');
      S3Client = s3Module.S3Client;
      PutObjectCommand = s3Module.PutObjectCommand;
      GetObjectCommand = s3Module.GetObjectCommand;
      const presigner = await import('@aws-sdk/s3-request-presigner');
      getSignedUrl = presigner.getSignedUrl;

      this.client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId: this.config.get('S3_ACCESS_KEY', ''),
          secretAccessKey: this.config.get('S3_SECRET_KEY', ''),
        },
      });
    }
    return this.client;
  }

  /**
   * Upload a buffer to S3 (or local fallback) and return an access URL.
   * Key example: "temp-reports/tenant-abc/sales-2025.xlsx"
   */
  async upload(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ url: string; isLocal: boolean }> {
    if (this.useS3) {
      return this.uploadToS3(key, buffer, contentType);
    }
    return this.uploadToLocal(key, buffer);
  }

  private async uploadToS3(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ url: string; isLocal: boolean }> {
    const client = await this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        // Objects auto-expire after 24h via S3 lifecycle rule on /temp-reports/ prefix
      }),
    );
    // Generate presigned download URL valid for 1 hour
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 3600 },
    );
    this.logger.log(`Uploaded to S3: ${key}`);
    return { url, isLocal: false };
  }

  private async uploadToLocal(
    key: string,
    buffer: Buffer,
  ): Promise<{ url: string; isLocal: boolean }> {
    const localDir = join(process.cwd(), 'uploads', 'reports');
    if (!existsSync(localDir)) {
      await mkdir(localDir, { recursive: true });
    }
    // Flatten key to a safe filename
    const filename = key.replace(/\//g, '__');
    const localPath = join(localDir, filename);
    await writeFile(localPath, buffer);
    this.logger.log(`Saved locally: ${localPath}`);
    return {
      url: `/uploads/reports/${filename}`,
      isLocal: true,
    };
  }

  /** Returns a public-accessible URL from a local path or S3 presigned URL */
  resolvePublicUrl(url: string, apiBaseUrl: string): string {
    if (url.startsWith('http')) return url;
    return `${apiBaseUrl}${url}`;
  }
}
