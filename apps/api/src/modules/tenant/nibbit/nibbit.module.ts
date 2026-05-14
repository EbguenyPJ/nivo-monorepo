import { Module } from '@nestjs/common';
import { NibbitController } from './nibbit.controller';
import { NibbitService } from './nibbit.service';

@Module({
  controllers: [NibbitController],
  providers: [NibbitService],
})
export class NibbitModule {}
