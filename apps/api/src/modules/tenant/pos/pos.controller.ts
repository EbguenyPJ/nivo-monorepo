import { Controller, Get, Post, Query, Body, Req, UseGuards } from '@nestjs/common';
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

  // ─── Cash Registers ────────────────────────────────────────────

  @Get('cash-registers')
  getCashRegisters(@Req() req: Request, @Query('branch_id') branchId: string) {
    return this.posService.getCashRegisters(req.tenantConnection!, branchId);
  }

  @Post('cash-registers')
  createCashRegister(
    @Req() req: Request,
    @Body() body: { branch_id: string; name: string },
  ) {
    return this.posService.createCashRegister(req.tenantConnection!, body);
  }

  // ─── Sessions ──────────────────────────────────────────────────

  @Get('sessions/active')
  getActiveSession(
    @Req() req: Request,
    @Query('employee_id') employeeId?: string,
    @Query('cash_register_id') cashRegisterId?: string,
  ) {
    return this.posService.getActiveSession(req.tenantConnection!, req.user as any, employeeId, cashRegisterId);
  }

  @Post('sessions/open')
  openSession(
    @Req() req: Request,
    @Body() body: { branch_id: string; opening_amount: number; employee_id: string; cash_register_id: string },
  ) {
    return this.posService.openSession(req.tenantConnection!, body);
  }

  @Post('sessions/switch')
  switchCashier(
    @Req() req: Request,
    @Body() body: { session_id: string; new_employee_id: string },
  ) {
    return this.posService.switchCashier(req.tenantConnection!, body);
  }

  @Post('sessions/close')
  closeSession(@Req() req: Request, @Body() body: { session_id: string; closing_amount: number }) {
    return this.posService.closeSession(req.tenantConnection!, body);
  }

  // ─── PIN & Auth ────────────────────────────────────────────────

  @Post('verify-pin')
  verifyPin(@Req() req: Request, @Body() body: { pin_code: string; branch_id: string }) {
    return this.posService.verifyPin(req.tenantConnection!, body.pin_code, body.branch_id);
  }

  // ─── Catalog ────────────────────────────────────────────────────

  @Get('catalog')
  getPosCatalog(@Req() req: Request, @Query('branch_id') branchId: string) {
    return this.posService.getPosCatalog(req.tenantConnection!, branchId);
  }

  @Get('variant-prices-all')
  getVariantPricesByAllLists(
    @Req() req: Request,
    @Query('variant_id') variantId: string,
    @Query('branch_id') branchId: string,
  ) {
    return this.posService.getVariantPricesByAllLists(req.tenantConnection!, variantId, branchId);
  }

  // ─── Products & Sales ─────────────────────────────────────────

  @Get('products')
  getProductsWithStock(@Req() req: Request, @Query('branch_id') branchId: string) {
    return this.posService.getProductsWithStock(req.tenantConnection!, branchId);
  }

  @Post('transactions')
  createTransaction(@Req() req: Request, @Body() body: any) {
    return this.posService.createSale(req.tenantConnection!, req.user as any, body);
  }
}
