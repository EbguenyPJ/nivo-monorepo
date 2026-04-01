import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
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

  // ─── Colors ──────────────────────────────────────────────────
  @Get('colors')
  findAllColors(@Req() req: any) {
    return this.catalogsService.findAllColors(req.tenantConnection);
  }

  @Post('colors')
  createColor(@Req() req: any, @Body() body: { name: string; hex_code: string; branch_id?: string | null }) {
    return this.catalogsService.createColor(req.tenantConnection, body);
  }

  @Patch('colors/:id')
  updateColor(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.catalogsService.updateColor(req.tenantConnection, id, body);
  }

  // ─── Size Groups ─────────────────────────────────────────────
  @Get('size-groups')
  findAllSizeGroups(@Req() req: any) {
    return this.catalogsService.findAllSizeGroups(req.tenantConnection);
  }

  @Post('size-groups')
  createSizeGroup(@Req() req: any, @Body() body: { name: string }) {
    return this.catalogsService.createSizeGroup(req.tenantConnection, body);
  }

  @Patch('size-groups/:id')
  updateSizeGroup(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.catalogsService.updateSizeGroup(req.tenantConnection, id, body);
  }

  // ─── Size Systems ────────────────────────────────────────────
  @Get('size-systems')
  findAllSizeSystems(@Req() req: any) {
    return this.catalogsService.findAllSizeSystems(req.tenantConnection);
  }

  @Post('size-systems')
  createSizeSystem(@Req() req: any, @Body() body: { name: string }) {
    return this.catalogsService.createSizeSystem(req.tenantConnection, body);
  }

  @Patch('size-systems/:id')
  updateSizeSystem(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.catalogsService.updateSizeSystem(req.tenantConnection, id, body);
  }

  // ─── Sizes (rows + equivalencies) ────────────────────────────
  @Get('sizes')
  findSizesByGroup(@Req() req: any, @Query('group_id') groupId: string) {
    return this.catalogsService.findSizesByGroup(req.tenantConnection, groupId);
  }

  @Post('sizes')
  createSize(@Req() req: any, @Body() body: { size_group_id: string; equivalencies: { size_system_id: string; value: string }[] }) {
    return this.catalogsService.createSize(req.tenantConnection, body);
  }

  @Patch('sizes/:id/equivalencies')
  updateSizeEquivalencies(@Req() req: any, @Param('id') id: string, @Body() body: { equivalencies: { size_system_id: string; value: string }[] }) {
    return this.catalogsService.updateSizeEquivalencies(req.tenantConnection, id, body.equivalencies);
  }

  @Patch('sizes/reorder')
  reorderSizes(@Req() req: any, @Body() body: { items: { id: string; order_index: number }[] }) {
    return this.catalogsService.reorderSizes(req.tenantConnection, body.items);
  }

  @Delete('sizes/:id')
  deleteSize(@Req() req: any, @Param('id') id: string) {
    return this.catalogsService.deleteSize(req.tenantConnection, id);
  }
}
