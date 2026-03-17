import { Controller, Get, Post, Body, Query, Req, UseGuards } from '@nestjs/common';
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
  findAll(@Req() req: Request, @Query('search') search?: string) {
    return this.customersService.findAll(req.tenantConnection!, search);
  }

  @Post()
  create(@Req() req: Request, @Body() body: any) {
    return this.customersService.create(req.tenantConnection!, body);
  }

  @Post('redeem-points')
  redeemPoints(@Req() req: Request, @Body() body: { customer_id: string; points: number }) {
    return this.customersService.redeemPoints(req.tenantConnection!, body);
  }
}
