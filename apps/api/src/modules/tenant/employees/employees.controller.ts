import { Controller, Get, Post, Put, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';

@ApiTags('Employees')
@Controller('employees')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(@Req() req: Request) {
    return this.employeesService.findAll(req.tenantConnection!);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.employeesService.findOne(req.tenantConnection!, id);
  }

  @Post()
  create(@Req() req: Request, @Body() body: any) {
    return this.employeesService.create(req.tenantConnection!, body);
  }

  @Put(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.employeesService.update(req.tenantConnection!, id, body);
  }
}
