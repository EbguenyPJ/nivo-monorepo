import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(AuthGuard('jwt'))
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** Main KPIs: net revenue, gross profit/margin, shrinkage, avg ticket */
  @Get('kpis')
  getKpis(
    @Req() req: any,
    @Query('branch_id') branchId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.dashboardService.getKpis(req.tenantConnection, {
      branch_id: branchId,
      start_date: startDate,
      end_date: endDate,
    });
  }

  /** Daily revenue + gross profit trend for charts */
  @Get('profitability-trend')
  getProfitabilityTrend(
    @Req() req: any,
    @Query('branch_id') branchId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.dashboardService.getProfitabilityTrend(req.tenantConnection, {
      branch_id: branchId,
      start_date: startDate,
      end_date: endDate,
    });
  }

  /** Operational alerts: pending audits, stale transfers, low stock */
  @Get('alerts')
  getAlerts(
    @Req() req: any,
    @Query('branch_id') branchId?: string,
  ) {
    return this.dashboardService.getAlerts(req.tenantConnection, branchId);
  }

  /** Top N most profitable products */
  @Get('top-profitable')
  getTopProfitable(
    @Req() req: any,
    @Query('branch_id') branchId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dashboardService.getTopProfitable(req.tenantConnection, {
      branch_id: branchId,
      start_date: startDate,
      end_date: endDate,
      limit: limit ? parseInt(limit) : 5,
    });
  }

  /** Revenue breakdown by brand — for donut chart */
  @Get('category-breakdown')
  getCategoryBreakdown(
    @Req() req: any,
    @Query('branch_id') branchId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.dashboardService.getCategoryBreakdown(req.tenantConnection, {
      branch_id: branchId,
      start_date: startDate,
      end_date: endDate,
    });
  }

  /** Heatmap: sales count grouped by day-of-week × hour */
  @Get('hourly-heatmap')
  getHourlyHeatmap(
    @Req() req: any,
    @Query('branch_id') branchId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.dashboardService.getHourlyHeatmap(req.tenantConnection, {
      branch_id: branchId,
      start_date: startDate,
      end_date: endDate,
    });
  }

  @Get('customer-heatmap')
  getCustomerHeatmap(
    @Req() req: any,
    @Query('branch_id') branchId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.dashboardService.getCustomerHeatmap(req.tenantConnection, {
      branch_id: branchId,
      start_date: startDate,
      end_date: endDate,
    });
  }

  /** Zone heatmap: demand/revenue/delivery metrics aggregated by geographic zone + blind zones */
  @Get('zone-heatmap')
  getZoneHeatmap(
    @Req() req: any,
    @Query('branch_id') branchId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.dashboardService.getZoneHeatmap(req.tenantConnection, {
      branch_id: branchId,
      start_date: startDate,
      end_date: endDate,
    });
  }

  /** Profitability drill-down report, groupable by brand/collection/seller */
  @Get('profitability-report')
  getProfitabilityReport(
    @Req() req: any,
    @Query('branch_id') branchId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('group_by') groupBy?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dashboardService.getProfitabilityReport(req.tenantConnection, {
      branch_id: branchId,
      start_date: startDate,
      end_date: endDate,
      group_by: (groupBy as 'brand' | 'collection' | 'seller') || 'brand',
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }
}
