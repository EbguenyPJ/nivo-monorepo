import { Controller, Get, Post, Put, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';
import { Roles } from '../../../core/auth/roles.decorator';

@ApiTags('Branches')
@Controller('branches')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.branchesService.findAll(req.tenantConnection!);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.branchesService.findOne(req.tenantConnection!, id);
  }

  @Post()
  @Roles('admin')
  create(@Req() req: Request, @Body() body: any) {
    return this.branchesService.create(req.tenantConnection!, body);
  }

  @Put(':id')
  @Roles('admin')
  update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.branchesService.update(req.tenantConnection!, id, body);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.branchesService.remove(req.tenantConnection!, id);
  }
}
