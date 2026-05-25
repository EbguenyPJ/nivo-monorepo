import { Controller, Get, Post, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';

/**
 * Customer-facing address endpoints for the mobile B2C app.
 * Scoped to the authenticated customer's addresses.
 */
@ApiTags('Mobile Addresses')
@Controller('mobile/addresses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MobileAddressesController {
  constructor(private readonly customersService: CustomersService) {}

  /** List the authenticated customer's saved addresses */
  @Get()
  async myAddresses(@Req() req: any) {
    const customerId = req.user.customer_id;
    if (!customerId) return { items: [] };
    const customer = await this.customersService.findOne(
      req.tenantConnection!,
      customerId,
    );
    const addresses = (customer as any).addresses ?? [];
    return {
      items: addresses.map((a: any) => ({
        id: a.id,
        label: a.label,
        street: a.street,
        neighborhood: a.neighborhood,
        city: a.city,
        state: a.state,
        zip_code: a.zip_code,
        country: a.country,
        reference: a.reference,
        is_default: a.is_default,
      })),
    };
  }

  /** Create a new address for the authenticated customer */
  @Post()
  async createAddress(@Req() req: any, @Body() body: any) {
    const customerId = req.user.customer_id;
    const address = await this.customersService.addAddress(
      req.tenantConnection!,
      customerId,
      {
        label: body.label || null,
        street: body.street,
        neighborhood: body.neighborhood || null,
        city: body.city,
        state: body.state,
        zip_code: body.zip_code,
        country: body.country || 'Mexico',
        reference: body.reference || null,
        is_default: body.is_default || false,
      },
    );
    return {
      id: address.id,
      label: address.label,
      street: address.street,
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      zip_code: address.zip_code,
      country: address.country,
      reference: address.reference,
      is_default: address.is_default,
    };
  }

  /** Delete an address (only if it belongs to the customer) */
  @Delete(':id')
  async deleteAddress(@Req() req: any, @Param('id') id: string) {
    // removeAddress validates existence
    await this.customersService.removeAddress(req.tenantConnection!, id);
    return { success: true };
  }
}
