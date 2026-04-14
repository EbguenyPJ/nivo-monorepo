import { Controller, Get, Post, Put, Param, Body, Req, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { CreditAccountsService } from './credit-accounts.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';
import { Roles } from '../../../core/auth/roles.decorator';

@ApiTags('Credit Accounts')
@Controller('credit-accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CreditAccountsController {
  constructor(private readonly creditAccountsService: CreditAccountsService) {}

  @Get()
  findAll(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.creditAccountsService.findAll(req.tenantConnection!, {
      status: (status as any) || 'all',
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get('kpis')
  getKpis(@Req() req: Request) {
    return this.creditAccountsService.getKpis(req.tenantConnection!);
  }

  @Get('by-customer/:customerId')
  findByCustomer(@Req() req: Request, @Param('customerId') customerId: string) {
    return this.creditAccountsService.findByCustomer(req.tenantConnection!, customerId);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.creditAccountsService.findOne(req.tenantConnection!, id);
  }

  @Get(':id/transactions')
  getTransactions(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.creditAccountsService.getTransactions(
      req.tenantConnection!, id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Post()
  @Roles('admin')
  createAccount(@Req() req: Request, @Body() body: any) {
    return this.creditAccountsService.createAccount(req.tenantConnection!, body);
  }

  @Put(':id')
  @Roles('admin')
  updateAccount(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.creditAccountsService.updateAccount(req.tenantConnection!, id, body);
  }

  @Post(':id/payment')
  registerPayment(@Req() req: Request, @Param('id') id: string, @Body() body: any) {
    return this.creditAccountsService.registerPayment(req.tenantConnection!, {
      credit_account_id: id,
      ...body,
      employee_id: body.employee_id || (req as any).user?.sub,
    });
  }

  @Post('charge')
  charge(@Req() req: Request, @Body() body: any) {
    return this.creditAccountsService.charge(req.tenantConnection!, {
      ...body,
      employee_id: body.employee_id || (req as any).user?.sub,
    });
  }
}
