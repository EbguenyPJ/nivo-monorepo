import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { join } from 'path';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { ReportType } from '../interfaces/report-job.interface';

@Injectable()
export class PdfRendererService {
  private readonly logger = new Logger(PdfRendererService.name);
  private readonly frontendUrl: string;
  private readonly chromiumPath: string | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:3001');
    this.chromiumPath = config.get('CHROMIUM_PATH');
  }

  generateRenderToken(
    tenantId: string,
    databaseName: string,
    reportType: string,
    filters: Record<string, string>,
  ): string {
    return this.jwt.sign(
      {
        tenant_id: tenantId,
        database_name: databaseName,
        report_type: reportType,
        filters,
        purpose: 'report-render',
      },
      { expiresIn: '60s', secret: this.config.get('JWT_SECRET') },
    );
  }

  async render(
    tenantId: string,
    databaseName: string,
    reportType: ReportType,
    filters: Record<string, string>,
  ): Promise<{ buffer: Buffer; tempPath: string }> {
    const token = this.generateRenderToken(tenantId, databaseName, reportType, filters);

    const params = new URLSearchParams({ token, ...filters });
    const printUrl = `${this.frontendUrl}/print/${reportType}?${params.toString()}`;

    this.logger.log(`[Rendering PDF] ${printUrl}`);

    let puppeteer: any;
    try {
      puppeteer = await import('puppeteer-core');
    } catch {
      throw new Error('puppeteer-core not installed');
    }

    const executablePath = this.chromiumPath || this.findSystemChrome();

    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const tempDir = join(process.cwd(), 'tmp');
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }
    const tempPath = join(tempDir, `report-${tenantId}-${Date.now()}.pdf`);

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.setExtraHTTPHeaders({ 'X-Print-Token': token });

      await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 30_000 });

      await page
        .waitForSelector('[data-print-ready="true"]', { timeout: 15_000 })
        .catch(() => new Promise((r) => setTimeout(r, 3_000)));

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      });

      const buffer = Buffer.from(pdfBuffer);
      await writeFile(tempPath, buffer);

      this.logger.log(`[Rendering PDF] Complete: ${buffer.byteLength} bytes → ${tempPath}`);
      return { buffer, tempPath };
    } finally {
      await browser.close();
    }
  }

  private findSystemChrome(): string {
    const platform = process.platform;
    if (platform === 'darwin') {
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    }
    if (platform === 'linux') {
      return '/usr/bin/google-chrome';
    }
    if (platform === 'win32') {
      return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    }
    return 'google-chrome';
  }
}
