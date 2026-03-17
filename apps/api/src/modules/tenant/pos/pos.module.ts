import { Module } from '@nestjs/common';
import { PosController } from './pos.controller';
import { SalesSyncController } from './sales-sync.controller';
import { PosService } from './pos.service';

@Module({
  controllers: [PosController, SalesSyncController],
  providers: [PosService],
})
export class PosModule {}
