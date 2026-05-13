import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { join } from 'path';
import { Tenant } from '@nivo/database';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';

/**
 * Tenant-facing support endpoints.
 * Uses the same SupportService as the admin controller but scoped to the requesting tenant.
 * Endpoint prefix: /tenant-support (bypasses tenant middleware since it reads from master DB)
 */
@ApiTags('Tenant Support')
@Controller('tenant-support')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TenantSupportController {
  constructor(
    private readonly supportService: SupportService,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  /** Resolve tenant name from master DB */
  private async getTenantName(tenantId: string): Promise<string> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    return tenant?.name || 'Tenant';
  }

  /** List the tenant's own tickets */
  @Get('tickets')
  async findMyTickets(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 15,
    @Query('status') status?: string,
  ) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new ForbiddenException('Acceso denegado');
    return this.supportService.findAll(+page, +limit, {
      tenant_id: tenantId,
      status,
    });
  }

  /** Get one ticket (only if it belongs to this tenant) */
  @Get('tickets/:id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new ForbiddenException('Acceso denegado');
    const ticket = await this.supportService.findOne(id);
    if (ticket.tenant_id !== tenantId) {
      throw new ForbiddenException('No tienes acceso a este ticket');
    }
    return ticket;
  }

  /** Create a new support ticket */
  @Post('tickets')
  @UseInterceptors(FilesInterceptor('attachments', 3))
  async create(
    @Req() req: any,
    @Body() body: { subject: string; message: string; category?: string; priority?: string },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new ForbiddenException('Acceso denegado');
    const tenantName = await this.getTenantName(tenantId);

    return this.supportService.create(
      {
        tenant_id: tenantId,
        tenant_name: tenantName,
        subject: body.subject,
        message: body.message,
        category: body.category || 'general',
        priority: body.priority || 'medium',
      },
      files,
    );
  }

  /** Add a message to a ticket (only if it belongs to this tenant) */
  @Post('tickets/:id/messages')
  @UseInterceptors(FilesInterceptor('attachments', 3))
  async addMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { message: string },
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new ForbiddenException('Acceso denegado');

    // Verify ownership
    const ticket = await this.supportService.findOne(id);
    if (ticket.tenant_id !== tenantId) {
      throw new ForbiddenException('No tienes acceso a este ticket');
    }

    const tenantName = await this.getTenantName(tenantId);

    return this.supportService.addMessage(
      id,
      { sender_type: 'tenant', sender_name: tenantName, message: body.message },
      files,
    );
  }

  /** Download an attachment */
  @Get('uploads/:filename')
  getFile(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = join(process.cwd(), 'uploads', 'support', safeName);
    return res.sendFile(filePath);
  }
}
