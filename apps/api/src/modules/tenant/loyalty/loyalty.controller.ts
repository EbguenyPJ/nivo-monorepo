import { Controller, Get, Put, Post, Body, Req, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { LoyaltyService } from './loyalty.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';
import { Roles } from '../../../core/auth/roles.decorator';

@ApiTags('Loyalty')
@Controller('loyalty')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('config')
  getConfig(@Req() req: Request) {
    return this.loyaltyService.getConfig(req.tenantConnection!);
  }

  @Put('config')
  @Roles('admin')
  updateConfig(@Req() req: Request, @Body() body: any) {
    return this.loyaltyService.updateConfig(req.tenantConnection!, body);
  }

  @Get('ledger/:customerId')
  getCustomerLedger(
    @Req() req: Request,
    @Param('customerId') customerId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.loyaltyService.getCustomerLedger(
      req.tenantConnection!,
      customerId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Post('earn')
  earnPoints(@Req() req: Request, @Body() body: any) {
    return this.loyaltyService.earnPoints(req.tenantConnection!, {
      ...body,
      employee_id: body.employee_id || (req as any).user?.sub,
    });
  }

  @Post('redeem')
  redeemPoints(@Req() req: Request, @Body() body: any) {
    return this.loyaltyService.redeemPoints(req.tenantConnection!, {
      ...body,
      employee_id: body.employee_id || (req as any).user?.sub,
    });
  }

  @Post('adjust')
  @Roles('admin')
  manualAdjustment(@Req() req: Request, @Body() body: any) {
    return this.loyaltyService.manualAdjustment(req.tenantConnection!, {
      ...body,
      employee_id: (req as any).user?.sub,
    });
  }

  @Get('points-value')
  calculatePointsValue(
    @Req() req: Request,
    @Query('points') points: string,
  ) {
    return this.loyaltyService.calculatePointsValue(req.tenantConnection!, parseInt(points) || 0)
      .then((value) => ({ points: parseInt(points) || 0, value }));
  }
}
