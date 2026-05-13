import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly provider: string;

  constructor(private readonly config: ConfigService) {
    this.provider = config.get<string>('STORAGE_PROVIDER', 'local');
  }

  async saveInvoiceXml(invoiceId: string, xmlBuffer: Buffer): Promise<string> {
    return this.save(invoiceId, 'xml', xmlBuffer);
  }

  async saveInvoicePdf(invoiceId: string, pdfBuffer: Buffer): Promise<string> {
    return this.save(invoiceId, 'pdf', pdfBuffer);
  }

  private async save(invoiceId: string, ext: 'xml' | 'pdf', buffer: Buffer): Promise<string> {
    if (this.provider === 's3') {
      return this.saveToS3(invoiceId, ext, buffer);
    }
    return this.saveLocally(invoiceId, ext, buffer);
  }

  private saveLocally(invoiceId: string, ext: string, buffer: Buffer): string {
    const dir = path.join(process.cwd(), 'uploads', 'invoices');
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${invoiceId}.${ext}`;
    fs.writeFileSync(path.join(dir, filename), buffer);
    const apiUrl = this.config.get<string>('API_URL', 'http://localhost:3000');
    return `${apiUrl}/api/v1/billing/files/${filename}`;
  }

  private async saveToS3(invoiceId: string, ext: string, buffer: Buffer): Promise<string> {
    // TODO: Implement AWS S3 upload when @aws-sdk/client-s3 is added as a dependency
    // const bucket = this.config.get('S3_BUCKET');
    // const region = this.config.get('S3_REGION');
    // const key = `invoices/${invoiceId}.${ext}`;
    // ... S3 PutObject command ...
    this.logger.warn('S3 storage not yet implemented — falling back to local');
    return this.saveLocally(invoiceId, ext, buffer);
  }

  /** Serve a locally stored invoice file (used by BillingController) */
  resolveLocalPath(filename: string): string | null {
    const filePath = path.join(process.cwd(), 'uploads', 'invoices', filename);
    if (fs.existsSync(filePath)) return filePath;
    return null;
  }
}
