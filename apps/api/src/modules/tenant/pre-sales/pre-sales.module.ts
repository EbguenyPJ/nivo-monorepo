import { Module } from '@nestjs/common';
import { PreSalesController } from './pre-sales.controller';
import { PreSalesService } from './pre-sales.service';

@Module({
  controllers: [PreSalesController],
  providers: [PreSalesService],
  exports: [PreSalesService],
})
export class PreSalesModule {}
