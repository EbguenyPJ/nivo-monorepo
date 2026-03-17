import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PosService } from './pos.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';

@ApiTags('POS')
@Controller('pos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Get('sessions/active')
  getActiveSession(@Req() req: Request) {
    return this.posService.getActiveSession(req.tenantConnection!, req.user as any);
  }

  @Post('sessions/open')
  openSession(@Req() req: Request, @Body() body: { branch_id: string; opening_amount: number }) {
    return this.posService.openSession(req.tenantConnection!, req.user as any, body);
  }

  @Post('sessions/close')
  closeSession(@Req() req: Request, @Body() body: { session_id: string; closing_amount: number }) {
    return this.posService.closeSession(req.tenantConnection!, body);
  }

  @Post('transactions')
  createTransaction(@Req() req: Request, @Body() body: any) {
    return this.posService.createSale(req.tenantConnection!, req.user as any, body);
  }
}
