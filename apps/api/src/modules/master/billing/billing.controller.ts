import {
  Controller, Get, Put, Post, Param, Body, Query, Req, UseGuards, Res,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { BillingService } from './billing.service';
import { StorageService } from './storage.service';

// Strict RFC regex — supports both Personas Morales (12) and Físicas (13)
const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/;

@ApiTags('Billing')
@Controller('billing')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly storageService: StorageService,
  ) {}

  // ─── Billing Profile ─────────────────────────────────────────────────────

  @Get('profile')
  async getProfile(@Req() req: Request) {
    const tenantId = (req.user as any)?.tenant_id;
    if (!tenantId) return null;
    return this.billingService.getProfile(tenantId);
  }

  @Put('profile')
  async upsertProfile(
    @Req() req: Request,
    @Body() body: {
      rfc: string;
      legal_name: string;
      zip_code: string;
      tax_regime: string;
      cfdi_use?: string;
      requires_invoice?: boolean;
    },
  ) {
    const tenantId = (req.user as any)?.tenant_id;
    if (!tenantId) throw new BadRequestException('Missing tenant context');

    // RFC validation
    if (!RFC_REGEX.test(body.rfc?.toUpperCase())) {
      throw new BadRequestException(
        'RFC inválido. Debe tener el formato correcto (ej. XAXX010101000 o XEXX010101000).',
      );
    }

    return this.billingService.upsertProfile(tenantId, {
      ...body,
      rfc: body.rfc.toUpperCase().trim(),
      legal_name: body.legal_name.trim(),
    });
  }

  // ─── Invoice History ──────────────────────────────────────────────────────

  @Get('invoices')
  async getInvoices(
    @Req() req: Request,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    const tenantId = (req.user as any)?.tenant_id;
    if (!tenantId) return { data: [], total: 0, page: 1, pages: 0 };
    return this.billingService.getInvoices(tenantId, +page, +limit);
  }

  // ─── Retry Failed Invoice ─────────────────────────────────────────────────

  @Post('invoices/:id/retry')
  async retryInvoice(@Param('id') id: string, @Req() req: Request) {
    const tenantId = (req.user as any)?.tenant_id;
    if (!tenantId) throw new BadRequestException('Missing tenant context');
    await this.billingService.retryInvoice(id, tenantId);
    return { queued: true };
  }

  // ─── Serve locally stored invoice files ──────────────────────────────────

  @Get('files/:filename')
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    // Basic path traversal protection
    if (filename.includes('..') || filename.includes('/')) {
      res.status(400).send('Invalid filename');
      return;
    }

    const filePath = this.storageService.resolveLocalPath(filename);
    if (!filePath) {
      res.status(404).send('File not found');
      return;
    }

    const ext = filename.split('.').pop()?.toLowerCase();
    const contentType = ext === 'pdf' ? 'application/pdf' : 'application/xml';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(filePath);
  }
}
