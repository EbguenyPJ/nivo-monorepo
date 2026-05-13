import { Module } from '@nestjs/common';
import { NivoMailerService } from './mailer.service';

@Module({
  providers: [NivoMailerService],
  exports: [NivoMailerService],
})
export class NivoMailerModule {}
