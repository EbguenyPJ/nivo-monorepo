import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Req, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { CollectionsService } from './collections.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';
import { Roles } from '../../../core/auth/roles.decorator';

@ApiTags('Collections')
@Controller('collections')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get('tree')
  getTree(@Req() req: Request, @Query('includeInactive') includeInactive?: string) {
    return this.collectionsService.getTree(req.tenantConnection!, includeInactive === 'true');
  }

  @Get()
  findAll(@Req() req: Request, @Query('includeInactive') includeInactive?: string) {
    return this.collectionsService.findAll(req.tenantConnection!, includeInactive === 'true');
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.collectionsService.findOne(req.tenantConnection!, id);
  }

  @Post()
  @Roles('admin')
  create(@Req() req: Request, @Body() body: any) {
    return this.collectionsService.create(req.tenantConnection!, body);
  }

  @Put(':id')
  @Roles('admin')
  update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.collectionsService.update(req.tenantConnection!, id, body);
  }

  @Patch(':id/move')
  @Roles('admin')
  move(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.collectionsService.move(req.tenantConnection!, id, body);
  }

  @Patch('reorder')
  @Roles('admin')
  reorder(@Req() req: Request, @Body() body: { items: { id: string; sort_order: number }[] }) {
    return this.collectionsService.reorder(req.tenantConnection!, body.items);
  }

  @Patch(':id/toggle-status')
  @Roles('admin')
  toggleStatus(@Req() req: Request, @Param('id') id: string) {
    return this.collectionsService.toggleStatus(req.tenantConnection!, id);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.collectionsService.remove(req.tenantConnection!, id);
  }
}
