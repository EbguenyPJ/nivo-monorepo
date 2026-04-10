import { Controller, Get, Post, Put, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PurchasingService } from './purchasing.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';

@ApiTags('Purchasing')
@Controller('purchasing')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PurchasingController {
  constructor(private readonly purchasingService: PurchasingService) {}

  // ─── Suppliers ──────────────────────────────────────────────────

  @Get('suppliers')
  findAllSuppliers(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('active_only') activeOnly?: string,
  ) {
    return this.purchasingService.findAllSuppliers(req.tenantConnection!, {
      search,
      active_only: activeOnly === 'true',
    });
  }

  @Get('suppliers/:id')
  findSupplier(@Req() req: Request, @Param('id') id: string) {
    return this.purchasingService.findSupplierById(req.tenantConnection!, id);
  }

  @Post('suppliers')
  createSupplier(@Req() req: Request, @Body() body: any) {
    return this.purchasingService.createSupplier(req.tenantConnection!, body);
  }

  @Put('suppliers/:id')
  updateSupplier(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.purchasingService.updateSupplier(req.tenantConnection!, id, body);
  }

  @Patch('suppliers/:id/toggle-status')
  toggleSupplierStatus(@Req() req: Request, @Param('id') id: string) {
    return this.purchasingService.toggleSupplierStatus(req.tenantConnection!, id);
  }

  // ─── Purchase Orders ────────────────────────────────────────────

  @Get('orders')
  listOrders(
    @Req() req: Request,
    @Query('branch_id') branchId?: string,
    @Query('supplier_id') supplierId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.purchasingService.listPurchaseOrders(req.tenantConnection!, {
      branch_id: branchId,
      supplier_id: supplierId,
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('orders/detail')
  getOrderDetail(@Req() req: Request, @Query('order_id') orderId: string) {
    return this.purchasingService.getOrderDetail(req.tenantConnection!, orderId);
  }

  @Get('orders/kpis')
  getKpis(@Req() req: Request, @Query('supplier_id') supplierId?: string) {
    return this.purchasingService.getKpis(req.tenantConnection!, { supplier_id: supplierId });
  }

  @Post('orders/create')
  createOrder(@Req() req: Request, @Body() body: any) {
    return this.purchasingService.createPurchaseOrder(req.tenantConnection!, {
      ...body,
      created_by_id: body.created_by_id || (req.user as any)?.sub,
    });
  }

  @Post('orders/confirm')
  confirmOrder(@Req() req: Request, @Body() body: { order_id: string }) {
    return this.purchasingService.confirmOrder(req.tenantConnection!, body.order_id);
  }

  @Post('orders/receive')
  receiveOrder(@Req() req: Request, @Body() body: any) {
    return this.purchasingService.receiveOrder(req.tenantConnection!, {
      ...body,
      received_by_id: body.received_by_id || (req.user as any)?.sub,
    });
  }

  @Post('orders/cancel')
  cancelOrder(@Req() req: Request, @Body() body: { order_id: string }) {
    return this.purchasingService.cancelOrder(req.tenantConnection!, body.order_id);
  }

  // ─── Variant Search ─────────────────────────────────────────────

  @Get('search-variants')
  searchVariants(@Req() req: Request, @Query('search') search?: string) {
    return this.purchasingService.searchVariantsForOrder(req.tenantConnection!, search || '');
  }

  @Get('search-products')
  searchProducts(@Req() req: Request, @Query('search') search?: string) {
    return this.purchasingService.searchProductsForOrder(req.tenantConnection!, search || '');
  }

  // ─── Accounts Payable ──────────────────────────────────────────

  @Get('accounts-payable')
  listAccountsPayable(
    @Req() req: Request,
    @Query('supplier_id') supplierId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.purchasingService.listAccountsPayable(req.tenantConnection!, {
      supplier_id: supplierId,
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Post('accounts-payable/payment')
  registerPayment(@Req() req: Request, @Body() body: any) {
    return this.purchasingService.registerPayment(req.tenantConnection!, body);
  }
}
