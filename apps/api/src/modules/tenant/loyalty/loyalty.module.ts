import { Module } from '@nestjs/common';
import { LoyaltyController } from './loyalty.controller';
import { MobileLoyaltyController } from './mobile-loyalty.controller';
import { LoyaltyService } from './loyalty.service';

@Module({
  controllers: [LoyaltyController, MobileLoyaltyController],
  providers: [LoyaltyService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
