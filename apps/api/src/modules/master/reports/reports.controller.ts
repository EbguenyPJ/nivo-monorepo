import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { MasterReportsService } from './reports.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';
import { Roles } from '../../../core/auth/roles.decorator';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super-admin')
@ApiBearerAuth()
export class MasterReportsController {
  constructor(private readonly reportsService: MasterReportsService) {}

  @Get('mrr-history')
  getMrrHistory(@Query('months') months = 12) {
    return this.reportsService.getMrrHistory(+months);
  }

  @Get('revenue')
  getRevenueReport(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
  ) {
    return this.reportsService.getRevenueReport(startDate, endDate);
  }

  @Get('retention')
  getRetentionData() {
    return this.reportsService.getRetentionData();
  }

  @Get('tenant-growth')
  getTenantGrowth(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
  ) {
    return this.reportsService.getTenantGrowth(startDate, endDate);
  }

  @Get('export-csv')
  async exportCsv(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
    @Res() res: Response,
  ) {
    const csv = await this.reportsService.exportCsv(startDate, endDate);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="tenants-report.csv"',
    });
    res.send(csv);
  }
}
