import { Controller, Get, Post, Put, Patch, Param, Body, Req, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';
import { Roles } from '../../../core/auth/roles.decorator';

@ApiTags('Employees')
@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(@Req() req: Request, @Query('branch') branchId?: string) {
    return this.employeesService.findAll(req.tenantConnection!, branchId);
  }

  @Get('roles')
  getRoles(@Req() req: Request) {
    return this.employeesService.getRoles(req.tenantConnection!);
  }

  @Get('permissions')
  getPermissions(@Req() req: Request) {
    return this.employeesService.getPermissions(req.tenantConnection!);
  }

  @Get('roles/:roleId/permissions')
  getRolePermissions(@Req() req: Request, @Param('roleId') roleId: string) {
    return this.employeesService.getRolePermissions(req.tenantConnection!, roleId);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.employeesService.findOne(req.tenantConnection!, id);
  }

  @Get(':id/permissions')
  getEmployeePermissions(@Req() req: Request, @Param('id') id: string) {
    return this.employeesService.getEmployeePermissions(req.tenantConnection!, id);
  }

  @Post()
  @Roles('admin')
  create(@Req() req: Request, @Body() body: any) {
    return this.employeesService.create(req.tenantConnection!, body);
  }

  @Put(':id')
  @Roles('admin')
  update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.employeesService.update(req.tenantConnection!, id, body);
  }

  @Patch(':id/toggle-status')
  @Roles('admin')
  toggleStatus(@Req() req: Request, @Param('id') id: string) {
    return this.employeesService.toggleStatus(req.tenantConnection!, id);
  }
}
