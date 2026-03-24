import { Controller, Get, Post, Put, Patch, Param, Body, Req, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { BrandsService } from './brands.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';
import { Roles } from '../../../core/auth/roles.decorator';

@ApiTags('Brands')
@Controller('brands')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  findAll(@Req() req: Request, @Query('includeInactive') includeInactive?: string) {
    return this.brandsService.findAll(req.tenantConnection!, includeInactive === 'true');
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.brandsService.findOne(req.tenantConnection!, id);
  }

  @Post()
  @Roles('admin')
  create(@Req() req: Request, @Body() body: any) {
    return this.brandsService.create(req.tenantConnection!, body);
  }

  @Put(':id')
  @Roles('admin')
  update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.brandsService.update(req.tenantConnection!, id, body);
  }

  @Patch(':id/toggle-status')
  @Roles('admin')
  toggleStatus(@Req() req: Request, @Param('id') id: string) {
    return this.brandsService.toggleStatus(req.tenantConnection!, id);
  }
}
