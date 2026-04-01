import { Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  getSummary(
    @Req() req: Request,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('branch_id') branchId?: string,
  ) {
    return this.reportsService.getSummary(
      (req as any).tenantConnection,
      startDate,
      endDate,
      branchId,
    );
  }

  @Get('sales')
  getSales(
    @Req() req: Request,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('branch_id') branchId?: string,
  ) {
    return this.reportsService.getSales((req as any).tenantConnection, {
      startDate,
      endDate,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      branchId,
    });
  }

  @Get('daily-sales')
  getDailySales(
    @Req() req: Request,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('branch_id') branchId?: string,
  ) {
    return this.reportsService.getDailySales(
      (req as any).tenantConnection,
      startDate,
      endDate,
      branchId,
    );
  }

  @Get('branch-comparison')
  getBranchComparison(
    @Req() req: Request,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.reportsService.getBranchComparison(
      (req as any).tenantConnection,
      startDate,
      endDate,
    );
  }

  @Post('export-csv')
  exportCsv(@Req() req: Request) {
    return this.reportsService.enqueueExport((req as any).tenant);
  }
}
