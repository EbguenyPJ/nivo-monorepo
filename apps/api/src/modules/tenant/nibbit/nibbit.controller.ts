import { Controller, Post, Body, Req, UseGuards, HttpCode, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Tenant } from '@nivo/database';
import { TenantConnectionManager } from '../../../core/database/tenant-connection.manager';
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

@Controller('nibbit')
@UseGuards(AuthGuard('jwt'))
export class NibbitController {
  private readonly logger = new Logger(NibbitController.name);

  constructor(
    private readonly nibbitService: NibbitService,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly connectionManager: TenantConnectionManager,
  ) {}

  @Post('chat')
  @HttpCode(200)
  async chat(@Body() body: NibbitChatDto, @Req() req: any) {
    let connection = req.tenantConnection;
    let tenantName = req.tenant?.name || 'Tu negocio';

    if (!connection && req.user?.tenant_id) {
      const tenant = await this.tenantRepo.findOne({ where: { id: req.user.tenant_id } });
      if (!tenant) {
        throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);
      }
      connection = await this.connectionManager.getConnection(tenant.database_name);
      tenantName = tenant.name;
    }

    if (!connection) {
      throw new HttpException('No tenant context available', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.nibbitService.chat(connection, body.messages, tenantName);
    } catch (error: any) {
      this.logger.error(`Nibbit chat error: ${error.message}`, error.stack);
      throw new HttpException(
        { message: 'Error processing chat', detail: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
