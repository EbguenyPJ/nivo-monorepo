import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { MobileAddressesController } from './mobile-addresses.controller';
import { CustomersService } from './customers.service';
import { GeocodingModule } from '../geocoding/geocoding.module';

@Module({
  imports: [GeocodingModule],
  controllers: [CustomersController, MobileAddressesController],
  providers: [CustomersService],
})
export class CustomersModule {}
