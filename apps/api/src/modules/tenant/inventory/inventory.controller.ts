import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';

@ApiTags('Inventory')
@Controller('products')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findAll(
    @Req() req: Request,
    @Query('category') category?: string,
    @Query('brand') brand?: string,
    @Query('search') search?: string,
  ) {
    return this.inventoryService.findAllProducts(req.tenantConnection!, { category, brand, search });
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.inventoryService.findProductById(req.tenantConnection!, id);
  }

  @Post()
  create(@Req() req: Request, @Body() body: any) {
    return this.inventoryService.createProduct(req.tenantConnection!, body);
  }

  /** Wizard endpoint: creates product + variants + inventory in one transaction */
  @Post('wizard')
  createFromWizard(@Req() req: Request, @Body() body: any) {
    return this.inventoryService.createProductWizard(req.tenantConnection!, body);
  }

  @Put(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.inventoryService.updateProduct(req.tenantConnection!, id, body);
  }

  @Patch(':id/toggle-status')
  toggleStatus(@Req() req: Request, @Param('id') id: string) {
    return this.inventoryService.toggleProductStatus(req.tenantConnection!, id);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.inventoryService.softDeleteProduct(req.tenantConnection!, id);
  }

  @Post('inventory/adjustments')
  adjustInventory(@Req() req: Request, @Body() body: any) {
    return this.inventoryService.adjustInventory(req.tenantConnection!, body);
  }

  @Post('inventory/transfers')
  transferInventory(@Req() req: Request, @Body() body: any) {
    return this.inventoryService.transferInventory(req.tenantConnection!, body);
  }

  // ─── Inventory Location endpoints ───────────────────────────────

  /** GET /products/inventory/stock?branch_id=X — aggregate stock with variant details */
  @Get('inventory/stock')
  getStockByBranch(@Req() req: Request, @Query('branch_id') branchId: string) {
    return this.inventoryService.getStockByBranch(req.tenantConnection!, branchId);
  }

  /** GET /products/inventory/by-location?branch_id=X&location_id=Y */
  @Get('inventory/by-location')
  getStockByLocation(
    @Req() req: Request,
    @Query('branch_id') branchId: string,
    @Query('location_id') locationId?: string,
  ) {
    return this.inventoryService.getStockByLocation(req.tenantConnection!, {
      branch_id: branchId,
      location_id: locationId,
    });
  }

  /** POST /products/inventory/assign-location */
  @Post('inventory/assign-location')
  assignToLocation(@Req() req: Request, @Body() body: any) {
    return this.inventoryService.assignToLocation(req.tenantConnection!, body);
  }

  /** POST /products/inventory/move-location */
  @Post('inventory/move-location')
  moveWithinBranch(@Req() req: Request, @Body() body: any) {
    return this.inventoryService.moveWithinBranch(req.tenantConnection!, body);
  }

  // ─── Inventory Transfers (multi-step) ─────────────────────────

  @Get('inventory/transfers/list')
  listTransfers(
    @Req() req: Request,
    @Query('branch_id') branchId?: string,
    @Query('tab') tab?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.inventoryService.listTransfers(req.tenantConnection!, {
      branch_id: branchId,
      tab: tab as any,
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('inventory/transfers/count-incoming')
  countIncoming(@Req() req: Request, @Query('branch_id') branchId: string) {
    return this.inventoryService.countIncoming(req.tenantConnection!, branchId);
  }

  @Get('inventory/transfers/detail')
  getTransferDetail(@Req() req: Request, @Query('transfer_id') transferId: string) {
    return this.inventoryService.getTransferDetail(req.tenantConnection!, transferId);
  }

  @Get('inventory/transfers/search-variants')
  searchVariantsForTransfer(
    @Req() req: Request,
    @Query('branch_id') branchId: string,
    @Query('search') search?: string,
  ) {
    return this.inventoryService.searchVariantsForTransfer(req.tenantConnection!, branchId, search || '');
  }

  @Post('inventory/transfers/create')
  createTransfer(@Req() req: Request, @Body() body: any) {
    return this.inventoryService.createTransfer(req.tenantConnection!, {
      ...body,
      created_by_id: body.created_by_id || (req.user as any)?.sub,
    });
  }

  @Post('inventory/transfers/dispatch')
  dispatchTransfer(@Req() req: Request, @Body() body: { transfer_id: string }) {
    return this.inventoryService.dispatchTransfer(req.tenantConnection!, body.transfer_id);
  }

  @Post('inventory/transfers/receive')
  receiveTransfer(@Req() req: Request, @Body() body: any) {
    return this.inventoryService.receiveTransfer(req.tenantConnection!, {
      ...body,
      received_by_id: body.received_by_id || (req.user as any)?.sub,
    });
  }

  @Post('inventory/transfers/cancel')
  cancelTransfer(@Req() req: Request, @Body() body: { transfer_id: string }) {
    return this.inventoryService.cancelTransfer(req.tenantConnection!, body.transfer_id);
  }
}
