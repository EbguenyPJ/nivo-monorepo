import {
  Controller, Get, Post, Param, Body, Req, UseGuards,
} from '@nestjs/common';
import { LogisticsService } from './logistics.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';

@Controller('logistics')
@UseGuards(JwtAuthGuard)
export class LogisticsController {
  constructor(private readonly service: LogisticsService) {}

  @Post('track-location')
  async updateLocation(
    @Req() req: any,
    @Body() data: { orderId: string; lat: number; lng: number },
  ) {
    await this.service.saveLocation(req.tenantConnection, data.orderId, data.lat, data.lng);
    return { success: true };
  }

  @Get('tracking/:orderId')
  async getTracking(@Req() req: any, @Param('orderId') orderId: string) {
    return this.service.getTrackingHistory(req.tenantConnection, orderId);
  }

  @Get('tracking/:orderId/latest')
  async getLatest(@Req() req: any, @Param('orderId') orderId: string) {
    return this.service.getLatestLocation(req.tenantConnection, orderId);
  }
}
