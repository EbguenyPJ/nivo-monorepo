import { Module } from '@nestjs/common';
import { PosController } from './pos.controller';
import { SalesSyncController } from './sales-sync.controller';
import { PosService } from './pos.service';
import { CollectionsModule } from '../collections/collections.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [CollectionsModule, PricingModule],
  controllers: [PosController, SalesSyncController],
  providers: [PosService],
})
export class PosModule {}
