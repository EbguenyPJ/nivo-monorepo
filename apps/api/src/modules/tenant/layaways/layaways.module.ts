import { Module } from '@nestjs/common';
import { LayawaysController } from './layaways.controller';
import { MobileLayawaysController } from './mobile-layaways.controller';
import { LayawaysService } from './layaways.service';

@Module({
  controllers: [LayawaysController, MobileLayawaysController],
  providers: [LayawaysService],
  exports: [LayawaysService],
})
export class LayawaysModule {}
