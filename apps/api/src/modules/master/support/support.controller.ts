import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { join } from 'path';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';
import { Roles } from '../../../core/auth/roles.decorator';

@ApiTags('Support')
@Controller('support')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super-admin', 'soporte')
@ApiBearerAuth()
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('tickets')
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('tenant_id') tenantId?: string,
    @Query('search') search?: string,
  ) {
    return this.supportService.findAll(+page, +limit, {
      status,
      priority,
      tenant_id: tenantId,
      search,
    });
  }

  @Get('tickets/stats')
  getStats() {
    return this.supportService.getStats();
  }

  @Get('tickets/:id')
  findOne(@Param('id') id: string) {
    return this.supportService.findOne(id);
  }

  @Post('tickets')
  @UseInterceptors(FilesInterceptor('attachments', 3))
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false, transform: false }))
  create(
    @Body() body: Record<string, any>,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.supportService.create(body, files);
  }

  @Post('tickets/:id/messages')
  @UseInterceptors(FilesInterceptor('attachments', 3))
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false, transform: false }))
  addMessage(
    @Param('id') id: string,
    @Body() body: Record<string, any>,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.supportService.addMessage(id, body as any, files);
  }

  @Patch('tickets/:id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.supportService.updateStatus(id, body.status);
  }

  @Get('uploads/:filename')
  getFile(@Param('filename') filename: string, @Res() res: Response) {
    // Sanitize filename to prevent path traversal
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = join(process.cwd(), 'uploads', 'support', safeName);
    return res.sendFile(filePath);
  }
}
