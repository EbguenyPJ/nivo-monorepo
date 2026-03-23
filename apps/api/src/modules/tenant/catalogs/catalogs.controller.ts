import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { CatalogsService } from './catalogs.service';

@ApiTags('Catalogs')
@Controller('catalogs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  // ─── Payment Methods ──────────────────────────────────────────
  @Get('payment-methods')
  findAllPaymentMethods(@Req() req: any) {
    return this.catalogsService.findAllPaymentMethods(req.tenantConnection);
  }

  @Post('payment-methods')
  createPaymentMethod(@Req() req: any, @Body() body: { name: string; requires_reference?: boolean }) {
    return this.catalogsService.createPaymentMethod(req.tenantConnection, body);
  }

  @Patch('payment-methods/:id')
  updatePaymentMethod(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.catalogsService.updatePaymentMethod(req.tenantConnection, id, body);
  }

  // ─── Taxes ────────────────────────────────────────────────────
  @Get('taxes')
  findAllTaxes(@Req() req: any) {
    return this.catalogsService.findAllTaxes(req.tenantConnection);
  }

  @Post('taxes')
  createTax(@Req() req: any, @Body() body: { name: string; percentage: number }) {
    return this.catalogsService.createTax(req.tenantConnection, body);
  }

  @Patch('taxes/:id')
  updateTax(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.catalogsService.updateTax(req.tenantConnection, id, body);
  }

  // ─── Cancellation Reasons ────────────────────────────────────
  @Get('cancellation-reasons')
  findAllCancellationReasons(@Req() req: any) {
    return this.catalogsService.findAllCancellationReasons(req.tenantConnection);
  }

  @Post('cancellation-reasons')
  createCancellationReason(@Req() req: any, @Body() body: { name: string }) {
    return this.catalogsService.createCancellationReason(req.tenantConnection, body);
  }

  @Patch('cancellation-reasons/:id')
  updateCancellationReason(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.catalogsService.updateCancellationReason(req.tenantConnection, id, body);
  }

  // ─── Units of Measure ────────────────────────────────────────
  @Get('units-of-measure')
  findAllUnitsOfMeasure(@Req() req: any) {
    return this.catalogsService.findAllUnitsOfMeasure(req.tenantConnection);
  }

  @Post('units-of-measure')
  createUnitOfMeasure(@Req() req: any, @Body() body: { name: string; abbreviation?: string }) {
    return this.catalogsService.createUnitOfMeasure(req.tenantConnection, body);
  }

  @Patch('units-of-measure/:id')
  updateUnitOfMeasure(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.catalogsService.updateUnitOfMeasure(req.tenantConnection, id, body);
  }
}
