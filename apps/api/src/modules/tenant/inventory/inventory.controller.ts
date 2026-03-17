import { Controller, Get, Post, Put, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
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
  findAll(@Req() req: Request, @Query('category') category?: string, @Query('brand') brand?: string) {
    return this.inventoryService.findAllProducts(req.tenantConnection!, { category, brand });
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.inventoryService.findProductById(req.tenantConnection!, id);
  }

  @Post()
  create(@Req() req: Request, @Body() body: any) {
    return this.inventoryService.createProduct(req.tenantConnection!, body);
  }

  @Put(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.inventoryService.updateProduct(req.tenantConnection!, id, body);
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
}
