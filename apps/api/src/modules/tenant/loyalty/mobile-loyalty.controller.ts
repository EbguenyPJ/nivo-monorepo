import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LoyaltyService } from './loyalty.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { DataSource } from 'typeorm';
import { Customer, LoyaltyLedger } from '@nivo/database';

/**
 * Customer-facing loyalty endpoint for the mobile B2C app.
 * Returns the loyalty profile for the authenticated customer.
 */
@ApiTags('Mobile Loyalty')
@Controller('mobile/loyalty')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MobileLoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  /** Get the authenticated customer's loyalty profile */
  @Get()
  async getProfile(@Req() req: any) {
    const conn: DataSource = req.tenantConnection!;
    const customerId: string = req.user.customer_id;

    // Fetch customer
    const customerRepo = conn.getRepository(Customer);
    const customer = await customerRepo.findOne({ where: { id: customerId } });
    if (!customer) {
      return { statusCode: 404, message: 'Cliente no encontrado' };
    }

    // Total purchases from loyalty ledger
    const ledgerRepo = conn.getRepository(LoyaltyLedger);
    const totalPurchases = await ledgerRepo.count({
      where: { customer_id: customerId, type: 'earned' },
    });

    return {
      customer_id: customer.id,
      name: customer.name,
      points: customer.loyalty_points ?? 0,
      tier: null, // Tier system not yet implemented
      qr_data: `nivo://loyalty/${customer.id}`,
      total_purchases: totalPurchases,
      member_since: customer.created_at,
    };
  }
}
