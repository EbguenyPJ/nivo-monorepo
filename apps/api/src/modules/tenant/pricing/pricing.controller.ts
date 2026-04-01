import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';
import { Roles } from '../../../core/auth/roles.decorator';
import { PricingService } from './pricing.service';

@ApiTags('Pricing')
@Controller('pricing')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  // ─── Price Lists ──────────────────────────────────────────────
  @Get('price-lists')
  findAllPriceLists(@Req() req: any) {
    return this.pricingService.findAllPriceLists(req.tenantConnection);
  }

  @Post('price-lists')
  @UseGuards(RolesGuard)
  @Roles('admin')
  createPriceList(@Req() req: any, @Body() body: { name: string; default_margin_percentage: number }) {
    return this.pricingService.createPriceList(req.tenantConnection, body);
  }

  @Patch('price-lists/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  updatePriceList(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.pricingService.updatePriceList(req.tenantConnection, id, body);
  }

  @Delete('price-lists/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  deletePriceList(@Req() req: any, @Param('id') id: string) {
    return this.pricingService.deletePriceList(req.tenantConnection, id);
  }

  @Patch('price-lists/:id/set-default')
  @UseGuards(RolesGuard)
  @Roles('admin')
  setDefaultPriceList(@Req() req: any, @Param('id') id: string) {
    return this.pricingService.setDefaultPriceList(req.tenantConnection, id);
  }

  @Get('default-price-list')
  findDefaultPriceList(@Req() req: any) {
    return this.pricingService.findDefaultPriceList(req.tenantConnection);
  }

  // ─── Branch Variant Overrides ─────────────────────────────────
  @Get('overrides/product/:productId')
  findBranchOverrides(@Req() req: any, @Param('productId') productId: string) {
    return this.pricingService.findBranchOverridesForProduct(req.tenantConnection, productId);
  }

  @Patch('overrides')
  @UseGuards(RolesGuard)
  @Roles('admin')
  batchUpsertOverrides(
    @Req() req: any,
    @Body() body: { overrides: Array<{ variant_id: string; branch_id: string; purchase_price_override: number | null }> },
  ) {
    return this.pricingService.batchUpsertBranchOverrides(req.tenantConnection, body.overrides);
  }

  // ─── Variant Price Margins ────────────────────────────────────
  @Get('margins/product/:productId')
  findVariantMargins(@Req() req: any, @Param('productId') productId: string) {
    return this.pricingService.findVariantMarginsForProduct(req.tenantConnection, productId);
  }

  @Patch('margins')
  @UseGuards(RolesGuard)
  @Roles('admin')
  batchUpsertMargins(
    @Req() req: any,
    @Body() body: { margins: Array<{ variant_id: string; price_list_id: string; custom_margin_percentage: number | null }> },
  ) {
    return this.pricingService.batchUpsertVariantMargins(req.tenantConnection, body.margins);
  }

  // ─── Price Calculator ─────────────────────────────────────────
  @Get('calculate')
  calculatePrice(
    @Req() req: any,
    @Query('variant_id') variantId: string,
    @Query('branch_id') branchId: string,
    @Query('price_list_id') priceListId: string,
  ) {
    return this.pricingService.calculatePrice(req.tenantConnection, variantId, branchId, priceListId);
  }

  @Get('calculate/product/:productId')
  calculateProductPrices(
    @Req() req: any,
    @Param('productId') productId: string,
    @Query('branch_id') branchId: string,
    @Query('price_list_id') priceListId: string,
  ) {
    return this.pricingService.calculateProductPrices(req.tenantConnection, productId, branchId, priceListId);
  }

  /** Get calculated prices for all products (for the product listing page) */
  @Get('product-list-prices')
  calculateProductListPrices(
    @Req() req: any,
    @Query('branch_id') branchId: string,
  ) {
    return this.pricingService.calculateProductListPrices(req.tenantConnection, branchId);
  }

  /** Get calculated price per variant (variant_id → final price) */
  @Get('variant-prices')
  calculateVariantPrices(
    @Req() req: any,
    @Query('branch_id') branchId: string,
  ) {
    return this.pricingService.calculateVariantPrices(req.tenantConnection, branchId);
  }
}
