import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { MobileCatalogService } from './mobile-catalog.service';

@Controller('mobile')
export class MobileCatalogController {
  constructor(private readonly service: MobileCatalogService) {}

  @Get('catalog')
  async listProducts(@Req() req: any, @Query() query: any) {
    return this.service.listProducts(req.tenantConnection, {
      search: query.search,
      category_id: query.category_id,
      brand_id: query.brand_id,
      limit: query.limit ? parseInt(query.limit) : 50,
      offset: query.offset ? parseInt(query.offset) : 0,
    });
  }

  @Get('catalog/categories')
  async getCategories(@Req() req: any) {
    return this.service.getCategories(req.tenantConnection);
  }

  @Get('catalog/brands')
  async getBrands(@Req() req: any) {
    return this.service.getBrands(req.tenantConnection);
  }

  @Get('catalog/:id')
  async getProduct(@Req() req: any, @Param('id') id: string) {
    return this.service.getProductDetail(req.tenantConnection, id);
  }

  @Get('branches')
  async getBranches(
    @Req() req: any,
    @Query('variant_ids') variantIds?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.service.getBranchesWithStock(
      req.tenantConnection,
      variantIds?.split(',').filter(Boolean),
      lat ? parseFloat(lat) : undefined,
      lng ? parseFloat(lng) : undefined,
    );
  }

  @Get('catalog/barcode/:barcode')
  async lookupBarcode(@Req() req: any, @Param('barcode') barcode: string) {
    return this.service.lookupBarcode(req.tenantConnection, barcode);
  }
}
