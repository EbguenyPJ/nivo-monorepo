import { Controller, Post, Get, Put, Body, Req, UseGuards } from '@nestjs/common';
import { MobileAuthService } from './mobile-auth.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';

@Controller('mobile/auth')
export class MobileAuthController {
  constructor(private readonly service: MobileAuthService) {}

  @Post('register')
  async register(@Req() req: any, @Body() body: { email: string; password: string; name: string; phone?: string }) {
    return this.service.register(req.tenantConnection, req.tenant?.id, body);
  }

  @Post('login')
  async login(@Req() req: any, @Body() body: { email: string; password: string }) {
    return this.service.login(req.tenantConnection, req.tenant?.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    return this.service.getProfile(req.tenantConnection, req.user.customer_id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('push-token')
  async updatePushToken(@Req() req: any, @Body() body: { push_token: string }) {
    await this.service.updatePushToken(req.tenantConnection, req.user.customer_id, body.push_token);
    return { message: 'Token actualizado' };
  }
}
