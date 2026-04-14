import { Module } from '@nestjs/common';
import { LayawaysController } from './layaways.controller';
import { LayawaysService } from './layaways.service';

@Module({
  controllers: [LayawaysController],
  providers: [LayawaysService],
  exports: [LayawaysService],
})
export class LayawaysModule {}
