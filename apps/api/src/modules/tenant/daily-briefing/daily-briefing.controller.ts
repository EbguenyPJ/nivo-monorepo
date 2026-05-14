import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DailyBriefingService } from './daily-briefing.service';

@Controller('analytics')
@UseGuards(AuthGuard('jwt'))
export class DailyBriefingController {
  constructor(private readonly briefingService: DailyBriefingService) {}

  @Get('daily-brief')
  async getDailyBrief(@Req() req: any) {
    const tenantName = req.tenant?.name || 'Tu negocio';
    return this.briefingService.generateBrief(req.tenantConnection, tenantName);
  }
}
