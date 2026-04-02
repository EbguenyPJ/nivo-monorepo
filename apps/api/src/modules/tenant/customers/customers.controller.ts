import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';

@ApiTags('Customers')
@Controller('customers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  findAll(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('is_active') isActive?: string,
    @Query('membership_tier') membershipTier?: string,
  ) {
    return this.customersService.findAll(req.tenantConnection!, {
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      is_active: isActive,
      membership_tier: membershipTier,
    });
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.customersService.findOne(req.tenantConnection!, id);
  }

  @Post()
  create(@Req() req: Request, @Body() body: any) {
    return this.customersService.create(req.tenantConnection!, body);
  }

  @Put(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.customersService.update(req.tenantConnection!, id, body);
  }

  @Patch(':id/toggle-status')
  toggleStatus(@Req() req: Request, @Param('id') id: string) {
    return this.customersService.toggleStatus(req.tenantConnection!, id);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.customersService.softDelete(req.tenantConnection!, id);
  }

  // ─── Addresses ─────────────────────────────────────────────────

  @Post(':id/addresses')
  addAddress(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.customersService.addAddress(req.tenantConnection!, id, body);
  }

  @Put('addresses/:addressId')
  updateAddress(@Req() req: Request, @Param('addressId') addressId: string, @Body() body: any) {
    return this.customersService.updateAddress(req.tenantConnection!, addressId, body);
  }

  @Delete('addresses/:addressId')
  removeAddress(@Req() req: Request, @Param('addressId') addressId: string) {
    return this.customersService.removeAddress(req.tenantConnection!, addressId);
  }

  // ─── Loyalty ───────────────────────────────────────────────────

  @Post('redeem-points')
  redeemPoints(@Req() req: Request, @Body() body: { customer_id: string; points: number }) {
    return this.customersService.redeemPoints(req.tenantConnection!, body);
  }
}
