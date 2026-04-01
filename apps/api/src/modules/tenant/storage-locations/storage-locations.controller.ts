import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { StorageLocationsService } from './storage-locations.service';

@ApiTags('Storage Locations')
@Controller('storage-locations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StorageLocationsController {
  constructor(private readonly service: StorageLocationsService) {}

  /** GET /storage-locations?branch_id=<uuid> — tree + flat list */
  @Get()
  findAll(@Req() req: any, @Query('branch_id') branchId: string) {
    return this.service.findAllByBranch(req.tenantConnection, branchId);
  }

  /** GET /storage-locations/:id — single with children */
  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req.tenantConnection, id);
  }

  /** POST /storage-locations — create one */
  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.service.create(req.tenantConnection, body);
  }

  /** POST /storage-locations/bulk — batch create */
  @Post('bulk')
  bulkCreate(
    @Req() req: any,
    @Body() body: { branch_id: string; locations: Array<{ parent_id?: string; name: string; code: string; type: string; description?: string }> },
  ) {
    return this.service.bulkCreate(req.tenantConnection, body.branch_id, body.locations);
  }

  /** PUT /storage-locations/:id — update */
  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.update(req.tenantConnection, id, body);
  }

  /** PATCH /storage-locations/:id/toggle-status */
  @Patch(':id/toggle-status')
  toggleStatus(@Req() req: any, @Param('id') id: string) {
    return this.service.toggleStatus(req.tenantConnection, id);
  }

  /** DELETE /storage-locations/:id */
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req.tenantConnection, id);
  }
}
