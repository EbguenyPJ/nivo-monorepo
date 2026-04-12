import { Controller, Get, Post, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuditsService } from './audits.service';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';

@ApiTags('Audits')
@Controller('audits')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AuditsController {
  constructor(private readonly auditsService: AuditsService) {}

  @Get('list')
  listAudits(
    @Req() req: Request,
    @Query('branch_id') branchId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.auditsService.listAudits(req.tenantConnection!, {
      branch_id: branchId,
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('detail')
  getDetail(@Req() req: Request, @Query('audit_id') auditId: string) {
    return this.auditsService.getAuditDetail(req.tenantConnection!, auditId);
  }

  @Get('kpis')
  getKpis(@Req() req: Request, @Query('branch_id') branchId?: string) {
    return this.auditsService.getKpis(req.tenantConnection!, { branch_id: branchId });
  }

  @Get('counting-progress')
  getCountingProgress(@Req() req: Request, @Query('audit_id') auditId: string) {
    return this.auditsService.getCountingProgress(req.tenantConnection!, auditId);
  }

  @Get('branch-locked')
  isBranchLocked(@Req() req: Request, @Query('branch_id') branchId: string) {
    return this.auditsService.isBranchLocked(req.tenantConnection!, branchId);
  }

  @Post('create')
  create(@Req() req: Request, @Body() body: any) {
    return this.auditsService.createAudit(req.tenantConnection!, {
      ...body,
      created_by_id: body.created_by_id || (req.user as any)?.sub,
    });
  }

  @Post('start-counting')
  startCounting(@Req() req: Request, @Body() body: { audit_id: string; lock_branch: boolean }) {
    return this.auditsService.startCounting(req.tenantConnection!, body.audit_id, body.lock_branch);
  }

  @Post('submit-count')
  submitCount(@Req() req: Request, @Body() body: { audit_id: string; variant_id: string; counted_quantity: number }) {
    return this.auditsService.submitCount(req.tenantConnection!, body);
  }

  @Post('scan')
  scanBarcode(@Req() req: Request, @Body() body: { audit_id: string; barcode: string }) {
    return this.auditsService.scanBarcode(req.tenantConnection!, body);
  }

  @Post('finish-counting')
  finishCounting(@Req() req: Request, @Body() body: { audit_id: string }) {
    return this.auditsService.finishCounting(req.tenantConnection!, body.audit_id);
  }

  @Post('request-recount')
  requestRecount(@Req() req: Request, @Body() body: { item_id: string }) {
    return this.auditsService.requestRecount(req.tenantConnection!, body.item_id);
  }

  @Post('accept-discrepancy')
  acceptDiscrepancy(@Req() req: Request, @Body() body: { item_id: string; reason: string }) {
    return this.auditsService.acceptDiscrepancy(req.tenantConnection!, body);
  }

  @Post('close-and-apply')
  closeAndApply(@Req() req: Request, @Body() body: { audit_id: string }) {
    return this.auditsService.closeAndApply(req.tenantConnection!, {
      audit_id: body.audit_id,
      closed_by_id: (req.user as any)?.sub,
    });
  }

  @Post('cancel')
  cancel(@Req() req: Request, @Body() body: { audit_id: string }) {
    return this.auditsService.cancelAudit(req.tenantConnection!, body.audit_id);
  }
}
