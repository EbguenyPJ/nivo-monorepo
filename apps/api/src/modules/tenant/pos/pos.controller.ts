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
  closeSession(
    @Req() req: Request,
    @Body() body: { session_id: string; declared_amount: number; closed_by?: string },
  ) {
    return this.posService.closeSession(req.tenantConnection!, body);
  }

  @Post('sessions/force-close')
  forceCloseSession(
    @Req() req: Request,
    @Body() body: { session_id: string; manager_employee_id: string },
  ) {
    return this.posService.forceCloseSession(req.tenantConnection!, body);
  }

  @Get('sessions/summary')
  getSessionSummary(@Req() req: Request, @Query('session_id') sessionId: string) {
    return this.posService.getSessionSummary(req.tenantConnection!, sessionId);
  }

  @Get('sessions/transactions')
  getSessionTransactions(@Req() req: Request, @Query('session_id') sessionId: string) {
    return this.posService.getSessionTransactions(req.tenantConnection!, sessionId);
  }

  @Get('sessions/expected-cash')
  getExpectedCash(@Req() req: Request, @Query('session_id') sessionId: string) {
    return this.posService.calculateExpectedCash(req.tenantConnection!, sessionId);
  }

  @Get('sessions/audit')
  getSessionsAudit(
    @Req() req: Request,
    @Query('branch_id') branchId?: string,
    @Query('employee_id') employeeId?: string,
    @Query('status') status?: string,
    @Query('only_differences') onlyDifferences?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.posService.getSessionsAudit(req.tenantConnection!, {
      branch_id: branchId,
      employee_id: employeeId,
      status,
      only_differences: onlyDifferences === 'true',
      start_date: startDate,
      end_date: endDate,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('vault/withdrawals')
  getVaultWithdrawals(
    @Req() req: Request,
    @Query('branch_id') branchId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.posService.getVaultWithdrawals(req.tenantConnection!, {
      branch_id: branchId,
      start_date: startDate,
      end_date: endDate,
    });
  }

  // ─── Cash Operations ──────────────────────────────────────────

  @Post('cash/in')
  addCashIn(
    @Req() req: Request,
    @Body() body: { session_id: string; employee_id: string; amount: number; description?: string },
  ) {
    return this.posService.addCashIn(req.tenantConnection!, body);
  }

  @Post('cash/out')
  addCashOut(
    @Req() req: Request,
    @Body() body: { session_id: string; employee_id: string; amount: number; description?: string },
  ) {
    return this.posService.addCashOut(req.tenantConnection!, body);
  }

  @Post('cash/audit')
  performAudit(
    @Req() req: Request,
    @Body() body: { session_id: string; employee_id: string; declared_amount: number },
  ) {
    return this.posService.performAudit(req.tenantConnection!, body);
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

  // ─── Ticket Config ──────────────────────────────────────────────

  @Get('ticket-config')
  getTicketConfig(@Req() req: Request, @Query('branch_id') branchId: string) {
    return this.posService.getTicketConfig(req.tenantConnection!, branchId);
  }

  // ─── Payment Methods ─────────────────────────────────────────

  @Get('payment-methods')
  getPaymentMethods(@Req() req: Request) {
    return this.posService.getPaymentMethods(req.tenantConnection!);
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

  // ─── Sales History ──────────────────────────────────────────────

  @Get('sales/history')
  getSalesHistory(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('branch_id') branchId?: string,
    @Query('customer_id') customerId?: string,
    @Query('status') status?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.posService.getSalesHistory(req.tenantConnection!, {
      search,
      branch_id: branchId,
      customer_id: customerId,
      status,
      start_date: startDate,
      end_date: endDate,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('sales/detail')
  getSaleDetail(@Req() req: Request, @Query('sale_id') saleId: string) {
    return this.posService.getSaleDetail(req.tenantConnection!, saleId);
  }

  // ─── Returns ────────────────────────────────────────────────────

  @Post('returns')
  processReturn(@Req() req: Request, @Body() body: any) {
    return this.posService.processReturn(req.tenantConnection!, req.user as any, body);
  }
}
