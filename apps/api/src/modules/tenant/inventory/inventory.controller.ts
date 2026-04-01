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
}
