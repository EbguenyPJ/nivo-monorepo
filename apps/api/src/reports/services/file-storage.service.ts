import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';

let S3Client: any;
let PutObjectCommand: any;
let GetObjectCommand: any;
let getSignedUrl: any;

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly useS3: boolean;
  private readonly bucket: string;
  private readonly region: string;
  private readonly apiBaseUrl: string;
  private client: any;

  constructor(private readonly config: ConfigService) {
    this.bucket = config.get<string>('REPORTS_S3_BUCKET') ?? config.get<string>('S3_BUCKET') ?? '';
    this.region = config.get<string>('REPORTS_S3_REGION') ?? config.get<string>('S3_REGION') ?? 'us-east-1';
    this.useS3 = !!(
      this.bucket &&
      (config.get('REPORTS_S3_ACCESS_KEY') || config.get('S3_ACCESS_KEY'))
    );
    this.apiBaseUrl = config.get('API_URL', 'http://localhost:3000');
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
          accessKeyId:
            this.config.get('REPORTS_S3_ACCESS_KEY') ||
            this.config.get('S3_ACCESS_KEY', ''),
          secretAccessKey:
            this.config.get('REPORTS_S3_SECRET_KEY') ||
            this.config.get('S3_SECRET_KEY', ''),
        },
      });
    }
    return this.client;
  }

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
      }),
    );

    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 3600 },
    );

    this.logger.log(`[Upload Successful] S3: ${key} (${buffer.byteLength} bytes)`);
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
    const filename = key.replace(/\//g, '__');
    const localPath = join(localDir, filename);
    await writeFile(localPath, buffer);
    this.logger.log(`[Upload Successful] Local: ${localPath} (${buffer.byteLength} bytes)`);
    return {
      url: `${this.apiBaseUrl}/uploads/reports/${filename}`,
      isLocal: true,
    };
  }

  async cleanupTempFile(filePath: string): Promise<void> {
    try {
      if (existsSync(filePath)) {
        await unlink(filePath);
        this.logger.log(`[Cleanup] Removed temp file: ${filePath}`);
      }
    } catch (err: any) {
      this.logger.warn(`[Cleanup] Failed to remove ${filePath}: ${err.message}`);
    }
  }
}
