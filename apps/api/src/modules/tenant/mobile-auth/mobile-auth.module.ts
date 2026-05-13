import { Module } from '@nestjs/common';
import { AuthModule } from '../../../core/auth/auth.module';
import { MobileAuthController } from './mobile-auth.controller';
import { MobileAuthService } from './mobile-auth.service';

@Module({
  imports: [AuthModule],
  controllers: [MobileAuthController],
  providers: [MobileAuthService],
  exports: [MobileAuthService],
})
export class MobileAuthModule {}
