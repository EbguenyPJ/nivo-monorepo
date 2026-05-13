import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { RequisitionsService } from './requisitions.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';

@ApiTags('Requisitions')
@Controller('requisitions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RequisitionsController {
  constructor(private readonly requisitionsService: RequisitionsService) {}

  // ─── List & Detail ──────────────────────────────────────────────

  @Get()
  listRequisitions(
    @Req() req: Request,
    @Query('branch_id') branchId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.requisitionsService.listRequisitions(req.tenantConnection!, {
      branch_id: branchId,
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('kpis')
  getKpis(@Req() req: Request, @Query('branch_id') branchId?: string) {
    return this.requisitionsService.getKpis(req.tenantConnection!, branchId);
  }

  @Get('draft')
  getDraft(@Req() req: Request, @Query('branch_id') branchId: string) {
    return this.requisitionsService.getOrCreateDraft(req.tenantConnection!, branchId);
  }

  @Get(':id')
  getDetail(@Req() req: Request, @Param('id') id: string) {
    return this.requisitionsService.getRequisitionDetail(req.tenantConnection!, id);
  }

  // ─── Draft Management ──────────────────────────────────────────

  /** Scan all inventory and populate the draft with items below minimum */
  @Post('generate')
  generateFromStock(@Req() req: Request, @Body() body: { branch_id: string }) {
    return this.requisitionsService.generateDraftFromStock(req.tenantConnection!, body.branch_id);
  }

  @Post(':id/items')
  addItem(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { variant_id: string; quantity: number; supplier_id?: string },
  ) {
    return this.requisitionsService.addItemToDraft(req.tenantConnection!, id, body);
  }

  @Delete(':id/items/:itemId')
  removeItem(@Req() req: Request, @Param('id') id: string, @Param('itemId') itemId: string) {
    return this.requisitionsService.removeItemFromDraft(req.tenantConnection!, id, itemId);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: { override_quantity?: number | null; supplier_id?: string },
  ) {
    return this.requisitionsService.updateItemQuantity(req.tenantConnection!, id, itemId, body);
  }

  // ─── State Machine ─────────────────────────────────────────────

  @Patch(':id/lock')
  lockRequisition(@Req() req: Request, @Param('id') id: string) {
    const employeeId = (req.user as any)?.sub;
    return this.requisitionsService.lockRequisition(req.tenantConnection!, id, employeeId);
  }

  @Patch(':id/unlock')
  unlockRequisition(@Req() req: Request, @Param('id') id: string) {
    return this.requisitionsService.unlockRequisition(req.tenantConnection!, id);
  }

  @Patch(':id/approve')
  approveRequisition(@Req() req: Request, @Param('id') id: string) {
    const employeeId = (req.user as any)?.sub;
    return this.requisitionsService.approveRequisition(req.tenantConnection!, id, employeeId);
  }

  // ─── Variant Suppliers ─────────────────────────────────────────

  @Get('variant-suppliers/:variantId')
  getVariantSuppliers(@Req() req: Request, @Param('variantId') variantId: string) {
    return this.requisitionsService.getVariantSuppliers(req.tenantConnection!, variantId);
  }

  @Post('variant-suppliers/:variantId')
  setVariantSuppliers(
    @Req() req: Request,
    @Param('variantId') variantId: string,
    @Body() body: { suppliers: Array<{ supplier_id: string; supplier_sku?: string; last_cost?: number; is_default?: boolean }> },
  ) {
    return this.requisitionsService.setVariantSuppliers(req.tenantConnection!, variantId, body.suppliers);
  }

  @Post('product-default-supplier/:productId')
  setProductDefaultSupplier(
    @Req() req: Request,
    @Param('productId') productId: string,
    @Body() body: { supplier_id: string; supplier_sku_prefix?: string; last_cost?: number },
  ) {
    return this.requisitionsService.setProductDefaultSupplier(
      req.tenantConnection!,
      productId,
      body.supplier_id,
      { supplier_sku_prefix: body.supplier_sku_prefix, last_cost: body.last_cost },
    );
  }

  // ─── Inventory Levels ──────────────────────────────────────────

  @Patch('inventory-levels')
  updateInventoryLevels(
    @Req() req: Request,
    @Body() body: { variant_id: string; branch_id: string; stock_minimum?: number; stock_maximum?: number },
  ) {
    return this.requisitionsService.updateInventoryLevels(req.tenantConnection!, body);
  }

  @Patch('inventory-levels/bulk')
  bulkUpdateInventoryLevels(
    @Req() req: Request,
    @Body() body: { branch_id: string; items: Array<{ variant_id: string; stock_minimum: number; stock_maximum: number }> },
  ) {
    return this.requisitionsService.bulkUpdateInventoryLevels(req.tenantConnection!, body.branch_id, body.items);
  }
}
