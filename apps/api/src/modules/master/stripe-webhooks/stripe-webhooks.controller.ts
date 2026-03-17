import { Controller, Post, Req, Headers, HttpCode } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { StripeWebhooksService } from './stripe-webhooks.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class StripeWebhooksController {
  constructor(private readonly stripeService: StripeWebhooksService) {}

  @Post('stripe')
  @HttpCode(200)
  async handleStripeWebhook(@Req() req: Request, @Headers('stripe-signature') signature: string) {
    return this.stripeService.handleWebhook(req.body, signature);
  }
}
