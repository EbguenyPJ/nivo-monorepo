import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportTicket, TicketMessage } from '@nivo/database';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [TypeOrmModule.forFeature([SupportTicket, TicketMessage])],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
