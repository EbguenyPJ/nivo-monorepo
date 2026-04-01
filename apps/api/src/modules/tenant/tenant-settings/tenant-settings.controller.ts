import { Controller, Get, Patch, Delete, Body, Query, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { TenantSettingsService } from './tenant-settings.service';

@ApiTags('Tenant Settings')
@Controller('tenant-settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TenantSettingsController {
  constructor(private readonly settingsService: TenantSettingsService) {}

  /**
   * GET /tenant-settings?group=operacion&branch_id=<uuid>
   *
   * If branch_id is provided: returns EffectiveSetting[] with override merge.
   * If branch_id is absent: returns global TenantSetting[] (original behavior).
   */
  @Get()
  findAll(
    @Req() req: any,
    @Query('group') group?: string,
    @Query('branch_id') branchId?: string,
  ) {
    if (branchId) {
      return this.settingsService.findAllEffective(req.tenantConnection, group, branchId);
    }
    return this.settingsService.findAllEffective(req.tenantConnection, group);
  }

  /**
   * PATCH /tenant-settings
   *
   * Body: {
   *   settings: { key: string; value: string }[],
   *   branch_id?: string,
   *   propagation?: 'default_only' | 'force_all'
   * }
   *
   * If branch_id is present: saves as branch-specific overrides.
   * If branch_id is absent: saves as global defaults with propagation control.
   */
  @Patch()
  async save(
    @Req() req: any,
    @Body() body: {
      settings: { key: string; value: string }[];
      branch_id?: string;
      propagation?: 'default_only' | 'force_all';
    },
  ) {
    const { settings, branch_id, propagation } = body;

    if (branch_id) {
      // Save as branch-specific overrides
      return this.settingsService.batchSetBranchOverrides(
        req.tenantConnection,
        branch_id,
        settings,
      );
    }

    // Save as global with propagation mode
    return this.settingsService.saveGlobalWithPropagation(
      req.tenantConnection,
      settings,
      propagation || 'default_only',
    );
  }

  /**
   * DELETE /tenant-settings/branch-override?branch_id=<uuid>&key=<key>
   *
   * Removes a single branch override, reverting to global default.
   */
  @Delete('branch-override')
  async removeBranchOverride(
    @Req() req: any,
    @Query('branch_id') branchId: string,
    @Query('key') key: string,
  ) {
    await this.settingsService.removeBranchOverride(req.tenantConnection, branchId, key);
    return { message: 'Override removed' };
  }
}
