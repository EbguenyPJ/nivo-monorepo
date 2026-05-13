import { Module } from '@nestjs/common';
import { MobileCatalogController } from './mobile-catalog.controller';
import { MobileCatalogService } from './mobile-catalog.service';

@Module({
  controllers: [MobileCatalogController],
  providers: [MobileCatalogService],
})
export class MobileCatalogModule {}
