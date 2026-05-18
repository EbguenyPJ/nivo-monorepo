import { Controller, Post, Get, Body, Query, Req, UseGuards, HttpCode, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository, In } from 'typeorm';
import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Tenant, EmailDraft } from '@nivo/database';
import { TenantConnectionManager } from '../../../core/database/tenant-connection.manager';
import { QUEUE_NAMES } from '../../../core/queue/queue.module';
import { NibbitService, ChatMessage } from './nibbit.service';

class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

class NibbitChatDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];
}

class SendEmailDraftItemDto {
  @IsString()
  draft_id: string;

  @IsString()
  subject: string;

  @IsString()
  body_html: string;
}

class SendEmailDraftsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SendEmailDraftItemDto)
  drafts: SendEmailDraftItemDto[];
}

@Controller('nibbit')
@UseGuards(AuthGuard('jwt'))
export class NibbitController {
  private readonly logger = new Logger(NibbitController.name);

  constructor(
    private readonly nibbitService: NibbitService,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly connectionManager: TenantConnectionManager,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notificationsQueue: Queue,
  ) {}

  @Post('chat')
  @HttpCode(200)
  async chat(@Body() body: NibbitChatDto, @Req() req: any) {
    let connection = req.tenantConnection;
    let tenantName = req.tenant?.name || 'Tu negocio';
    let tenantId = req.tenant?.id || req.user?.tenant_id;
    let databaseName = req.tenant?.database_name || '';

    if (!connection && req.user?.tenant_id) {
      const tenant = await this.tenantRepo.findOne({ where: { id: req.user.tenant_id } });
      if (!tenant) {
        throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);
      }
      connection = await this.connectionManager.getConnection(tenant.database_name);
      tenantName = tenant.name;
      tenantId = tenant.id;
      databaseName = tenant.database_name;
    }

    if (!connection) {
      throw new HttpException('No tenant context available', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.nibbitService.chat(connection, body.messages, tenantName, tenantId, databaseName);
    } catch (error: any) {
      this.logger.error(`Nibbit chat error: ${error.message}`, error.stack);
      throw new HttpException(
        { message: 'Error processing chat', detail: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('email-drafts')
  async getEmailDrafts(@Query('ids') ids: string, @Req() req: any) {
    const connection = await this.resolveTenantConnection(req);
    if (!ids) throw new HttpException('ids query param required', HttpStatus.BAD_REQUEST);

    const idList = ids.split(',').map((id) => id.trim()).filter(Boolean);
    const draftRepo = connection.getRepository(EmailDraft);
    const drafts = await draftRepo.find({
      where: { id: In(idList) },
      relations: ['supplier', 'purchase_order'],
    });

    return drafts.map((d: EmailDraft) => ({
      id: d.id,
      supplier_name: d.supplier?.name,
      supplier_email: d.to_email,
      subject: d.subject,
      body_html: d.body_html,
      pdf_url: d.pdf_url,
      po_folio: d.purchase_order?.folio,
      status: d.status,
    }));
  }

  @Post('send-email-drafts')
  @HttpCode(200)
  async sendEmailDrafts(@Body() body: SendEmailDraftsDto, @Req() req: any) {
    const connection = await this.resolveTenantConnection(req);
    const draftRepo = connection.getRepository(EmailDraft);

    const demoMode = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    const demoEmail = 'nivo.demo2@gmail.com';

    let sent = 0;
    let failed = 0;

    for (const item of body.drafts) {
      const draft = await draftRepo.findOne({ where: { id: item.draft_id } });
      if (!draft || draft.status !== 'pending') {
        failed++;
        continue;
      }

      draft.subject = item.subject;
      draft.body_html = item.body_html;

      try {
        const recipient = demoMode ? demoEmail : draft.to_email;

        await this.notificationsQueue.add('purchase-order-email', {
          type: 'email',
          to: recipient,
          subject: draft.subject,
          html: draft.body_html,
          attachments: draft.pdf_url ? [{ filename: `${draft.purchase_order_id}.pdf`, path: draft.pdf_url }] : [],
        });

        draft.status = 'sent';
        draft.sent_at = new Date();
        sent++;
      } catch (err: any) {
        draft.status = 'failed';
        draft.error_message = err.message;
        failed++;
        this.logger.error(`Failed to queue email draft ${draft.id}: ${err.message}`);
      }

      await draftRepo.save(draft);
    }

    return { sent, failed };
  }

  private async resolveTenantConnection(req: any) {
    if (req.tenantConnection) return req.tenantConnection;

    if (req.user?.tenant_id) {
      const tenant = await this.tenantRepo.findOne({ where: { id: req.user.tenant_id } });
      if (tenant) {
        return this.connectionManager.getConnection(tenant.database_name);
      }
    }

    throw new HttpException('No tenant context available', HttpStatus.BAD_REQUEST);
  }
}
