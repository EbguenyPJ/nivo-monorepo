import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Req, Query, UseGuards,
} from '@nestjs/common';
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

  // ═══════════════════════════════════════════════════════════════════
  //  PERMISSIONS — Catalog (must be before :id routes)
  // ═══════════════════════════════════════════════════════════════════

  @Get('permissions')
  getPermissions(@Req() req: Request) {
    return this.employeesService.getPermissions(req.tenantConnection!);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ROLES — CRUD + Permission Matrix (must be before :id routes)
  // ═══════════════════════════════════════════════════════════════════

  @Get('roles')
  getRoles(@Req() req: Request) {
    return this.employeesService.getRoles(req.tenantConnection!);
  }

  @Post('roles')
  @Roles('admin')
  createRole(@Req() req: Request, @Body() body: { name: string; slug: string; description?: string }) {
    return this.employeesService.createRole(req.tenantConnection!, body);
  }

  @Get('roles/:roleId')
  getRoleDetail(@Req() req: Request, @Param('roleId') roleId: string) {
    return this.employeesService.getRoles(req.tenantConnection!).then(
      (roles) => roles.find((r: any) => r.id === roleId) || null,
    );
  }

  @Put('roles/:roleId')
  @Roles('admin')
  updateRole(
    @Req() req: Request,
    @Param('roleId') roleId: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.employeesService.updateRole(req.tenantConnection!, roleId, body);
  }

  @Delete('roles/:roleId')
  @Roles('admin')
  deleteRole(@Req() req: Request, @Param('roleId') roleId: string) {
    return this.employeesService.deleteRole(req.tenantConnection!, roleId);
  }

  @Get('roles/:roleId/permissions')
  getRolePermissions(@Req() req: Request, @Param('roleId') roleId: string) {
    return this.employeesService.getRolePermissions(req.tenantConnection!, roleId);
  }

  @Put('roles/:roleId/permissions')
  @Roles('admin')
  setRolePermissions(
    @Req() req: Request,
    @Param('roleId') roleId: string,
    @Body() body: { permission_keys: string[] },
  ) {
    return this.employeesService.setRolePermissions(
      req.tenantConnection!,
      roleId,
      body.permission_keys || [],
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MANAGER OVERRIDE — PIN authorization (must be before :id routes)
  // ═══════════════════════════════════════════════════════════════════

  @Post('manager-override')
  managerOverride(
    @Req() req: Request,
    @Body() body: { pin: string; required_permission: string; branch_id: string; action_description?: string },
  ) {
    return this.employeesService.managerOverride(req.tenantConnection!, body);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  EMPLOYEES — CRUD
  // ═══════════════════════════════════════════════════════════════════

  @Get()
  findAll(@Req() req: Request, @Query('branch_id') branchId?: string) {
    return this.employeesService.findAll(req.tenantConnection!, branchId);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.employeesService.findOne(req.tenantConnection!, id);
  }

  @Get(':id/permissions')
  getEmployeePermissions(@Req() req: Request, @Param('id') id: string) {
    return this.employeesService.getEmployeePermissions(req.tenantConnection!, id);
  }

  @Get(':id/resolved-permissions')
  resolvePermissions(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('branch_id') branchId?: string,
  ) {
    return this.employeesService.resolvePermissions(req.tenantConnection!, id, branchId);
  }

  @Post()
  @Roles('admin')
  create(@Req() req: Request, @Body() body: any) {
    return this.employeesService.create(req.tenantConnection!, body);
  }

  @Put(':id')
  @Roles('admin')
  update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    const requesterId = (req as any).user?.sub;
    return this.employeesService.update(req.tenantConnection!, id, body, requesterId);
  }

  @Patch(':id/toggle-status')
  @Roles('admin')
  toggleStatus(@Req() req: Request, @Param('id') id: string) {
    return this.employeesService.toggleStatus(req.tenantConnection!, id);
  }
}
