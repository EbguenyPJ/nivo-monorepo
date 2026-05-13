import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export type PdfReportType = 'sales' | 'profitability' | 'audits' | 'performance' | 'dashboard';

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);
  private readonly frontendUrl: string;
  private readonly chromiumPath: string | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:3001');
    this.chromiumPath = config.get('CHROMIUM_PATH');
  }

  /**
   * Generate a one-time print token (30-second JWT) that the print page
   * uses to authenticate itself with the API.
   */
  generatePrintToken(tenantId: string, databaseName: string, reportType: string, filters: Record<string, string>): string {
    return this.jwtService.sign(
      { tenant_id: tenantId, database_name: databaseName, report_type: reportType, filters, purpose: 'print' },
      { expiresIn: '30s', secret: this.config.get('JWT_SECRET') },
    );
  }

  /**
   * Launch a headless Chromium instance, navigate to the print page,
   * wait for charts to render, and capture as PDF.
   */
  async generate(
    tenantId: string,
    databaseName: string,
    reportType: PdfReportType,
    filters: Record<string, string>,
  ): Promise<Buffer> {
    const token = this.generatePrintToken(tenantId, databaseName, reportType, filters);

    // Build print URL with token + filters
    const params = new URLSearchParams({ token, ...filters });
    const printUrl = `${this.frontendUrl}/print/${reportType}?${params.toString()}`;

    this.logger.log(`Generating PDF via headless browser: ${printUrl}`);

    let puppeteer: any;
    try {
      puppeteer = await import('puppeteer-core');
    } catch {
      throw new Error('puppeteer-core not installed. Run: pnpm add puppeteer-core --filter=api');
    }

    // Resolve executable path — env var, then common OS paths
    const executablePath =
      this.chromiumPath ||
      this.findSystemChrome();

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

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });

      // Inject the one-time token as a cookie so Next.js SSR can verify it
      await page.setExtraHTTPHeaders({ 'X-Print-Token': token });

      await page.goto(printUrl, { waitUntil: 'networkidle0', timeout: 30_000 });

      // Wait for charts to render (Recharts signals readiness via a data attribute)
      await page.waitForSelector('[data-print-ready="true"]', { timeout: 15_000 }).catch(() => {
        // If the marker never appears, just wait a bit and proceed
        return new Promise((r) => setTimeout(r, 3000));
      });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      });

      this.logger.log(`PDF generated: ${pdfBuffer.byteLength} bytes`);
      return Buffer.from(pdfBuffer);
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
      // Try common Linux paths
      const candidates = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium',
      ];
      return candidates[0]; // launcher will fail gracefully if not found
    }
    if (platform === 'win32') {
      return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    }
    return 'google-chrome';
  }
}
