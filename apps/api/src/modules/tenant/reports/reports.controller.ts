import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
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
  getSummary(@Req() req: Request) {
    return this.reportsService.getSummary((req as any).tenantConnection);
  }

  @Post('export-csv')
  exportCsv(@Req() req: Request) {
    return this.reportsService.enqueueExport((req as any).tenant);
  }
}
