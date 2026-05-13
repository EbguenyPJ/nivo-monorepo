import { Controller, Get, Post, Put, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
@UseGuards(AuthGuard('jwt'))
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  // ─── Categories ────────────────────────────────────────────────

  @Get('categories')
  listCategories(@Req() req: any) {
    return this.expensesService.listCategories(req.tenantConnection);
  }

  @Post('categories')
  createCategory(@Req() req: any, @Body() body: { name: string }) {
    return this.expensesService.createCategory(req.tenantConnection, body);
  }

  @Put('categories/:id')
  updateCategory(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.expensesService.updateCategory(req.tenantConnection, id, body);
  }

  // ─── Expenses ──────────────────────────────────────────────────

  @Get()
  listExpenses(
    @Req() req: any,
    @Query('branch_id') branchId?: string,
    @Query('category_id') categoryId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.expensesService.listExpenses(req.tenantConnection, {
      branch_id: branchId,
      category_id: categoryId,
      start_date: startDate,
      end_date: endDate,
      search,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('kpis')
  getKpis(
    @Req() req: any,
    @Query('branch_id') branchId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.expensesService.getKpis(req.tenantConnection, {
      branch_id: branchId,
      start_date: startDate,
      end_date: endDate,
    });
  }

  @Post()
  createExpense(@Req() req: any, @Body() body: any) {
    return this.expensesService.createExpense(req.tenantConnection, {
      ...body,
      employee_id: body.employee_id || (req.user as any)?.sub,
    });
  }

  /** POS-specific: register expense from the cash register */
  @Post('pos')
  createPosExpense(@Req() req: any, @Body() body: any) {
    return this.expensesService.createPosExpense(req.tenantConnection, {
      ...body,
      employee_id: body.employee_id || (req.user as any)?.sub,
    });
  }

  @Post(':id/cancel')
  cancelExpense(@Req() req: any, @Param('id') id: string, @Body() body: { reason: string }) {
    return this.expensesService.cancelExpense(req.tenantConnection, id, {
      employee_id: (req.user as any)?.sub,
      reason: body.reason,
    });
  }
}
