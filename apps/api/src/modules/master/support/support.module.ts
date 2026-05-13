import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { SupportTicket, TicketMessage, TicketAttachment, Tenant } from '@nivo/database';
import { SupportController } from './support.controller';
import { TenantSupportController } from './tenant-support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SupportTicket, TicketMessage, TicketAttachment, Tenant]),
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/support',
        filename: (_req, file, cb) => {
          const name = randomUUID() + extname(file.originalname);
          cb(null, name);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Solo se permiten imagenes'), false);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  ],
  controllers: [SupportController, TenantSupportController],
  providers: [SupportService],
})
export class SupportModule {}
