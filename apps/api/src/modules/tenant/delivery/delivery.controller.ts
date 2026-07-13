import {
  Controller, Get, Post, Param, Body, Req, UseGuards,
} from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';

@Controller('mobile/delivery')
export class DeliveryController {
  constructor(private readonly service: DeliveryService) {}

  /** Métodos de verificación requeridos para confirmar la entrega de un pedido */
  @UseGuards(JwtAuthGuard)
  @Get(':orderId/requirements')
  async getRequirements(@Req() req: any, @Param('orderId') orderId: string) {
    return this.service.getRequirements(req.tenantConnection, orderId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':orderId/proof')
  async submitProof(
    @Req() req: any,
    @Param('orderId') orderId: string,
    @Body() body: any,
  ) {
    return this.service.submitProof(req.tenantConnection, orderId, req.user.sub, {
      latitude: body.latitude,
      longitude: body.longitude,
      recipient_name: body.recipient_name,
      notes: body.notes,
      photo_url: body.photo_url,
      pin_code: body.pin_code,
      signature_data: body.signature_data,
      qr_payload: body.qr_payload,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':orderId/proof')
  async getProof(@Req() req: any, @Param('orderId') orderId: string) {
    return this.service.getProof(req.tenantConnection, orderId);
  }
}
