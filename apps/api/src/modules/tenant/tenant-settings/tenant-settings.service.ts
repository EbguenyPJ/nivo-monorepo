import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantSetting, BranchSettingOverride } from '@nivo/database';

/** Default settings that get seeded for new tenants */
export const DEFAULT_TENANT_SETTINGS: Partial<TenantSetting>[] = [
  {
    key: 'operacion.default_landed_cost_percentage',
    value: '0',
    label: 'Margen de Costo Operativo (%)',
    group: 'operacion',
  },
  {
    key: 'operacion.auto_generate_sku',
    value: 'true',
    label: 'Generar SKU automáticamente',
    group: 'operacion',
  },
  {
    key: 'operacion.require_barcode',
    value: 'false',
    label: 'Requerir código de barras al crear variantes',
    group: 'operacion',
  },
  {
    key: 'ticket.show_logo',
    value: 'true',
    label: 'Mostrar logo en tickets',
    group: 'ticket',
  },
  {
    key: 'ticket.show_branch_address',
    value: 'true',
    label: 'Mostrar dirección de sucursal en tickets',
    group: 'ticket',
  },
  {
    key: 'inventario.low_stock_threshold',
    value: '5',
    label: 'Umbral de stock bajo',
    group: 'inventario',
  },
];

export interface EffectiveSetting {
  id: string;
  key: string;
  value: string;          // effective value (override ?? global)
  globalValue: string;    // tenant_settings value
  isOverridden: boolean;  // true if branch override exists
  label: string | null;
  group: string | null;
}

@Injectable()
export class TenantSettingsService {
  // ─── Global Settings (original methods) ────────────────────────

  /** Get all settings (optionally filtered by group) */
  async findAll(connection: DataSource, group?: string) {
    const repo = connection.getRepository(TenantSetting);
    const where = group ? { group } : {};
    return repo.find({ where, order: { group: 'ASC', key: 'ASC' } });
  }

  /** Get a single setting by key */
  async findByKey(connection: DataSource, key: string) {
    const repo = connection.getRepository(TenantSetting);
    return repo.findOne({ where: { key } });
  }

  /** Upsert: update if exists, create if not */
  async upsert(connection: DataSource, key: string, value: string) {
    const repo = connection.getRepository(TenantSetting);
    const existing = await repo.findOne({ where: { key } });

    if (existing) {
      existing.value = value;
      return repo.save(existing);
    }

    return repo.save(repo.create({ key, value }));
  }

  /** Batch upsert multiple settings at once */
  async batchUpsert(connection: DataSource, settings: { key: string; value: string }[]) {
    const repo = connection.getRepository(TenantSetting);
    const results: TenantSetting[] = [];

    for (const s of settings) {
      const existing = await repo.findOne({ where: { key: s.key } });
      if (existing) {
        existing.value = s.value;
        results.push(await repo.save(existing));
      } else {
        results.push(await repo.save(repo.create({ key: s.key, value: s.value })));
      }
    }

    return results;
  }

  /** Get a setting's value with a fallback default */
  async getValue(connection: DataSource, key: string, defaultValue = ''): Promise<string> {
    const setting = await this.findByKey(connection, key);
    return setting?.value ?? defaultValue;
  }

  // ─── Effective Settings (with branch override cascade) ─────────

  /**
   * Returns all settings with effective values for a specific branch.
   * Each setting includes: effective value, global value, and override status.
   *
   * Cascade: BranchSettingOverride.value ?? TenantSetting.value
   */
  async findAllEffective(
    connection: DataSource,
    group?: string,
    branchId?: string,
  ): Promise<EffectiveSetting[]> {
    // 1. Load all global settings
    const globals = await this.findAll(connection, group);

    // 2. If no branch specified, return globals as-is
    if (!branchId) {
      return globals.map((s) => ({
        id: s.id,
        key: s.key,
        value: s.value,
        globalValue: s.value,
        isOverridden: false,
        label: s.label,
        group: s.group,
      }));
    }

    // 3. Load branch overrides
    const overrideRepo = connection.getRepository(BranchSettingOverride);
    const overrides = await overrideRepo.find({ where: { branch_id: branchId } });
    const overrideMap = new Map(overrides.map((o) => [o.key, o.value]));

    // 4. Merge: override takes precedence
    return globals.map((s) => {
      const hasOverride = overrideMap.has(s.key);
      return {
        id: s.id,
        key: s.key,
        value: hasOverride ? overrideMap.get(s.key)! : s.value,
        globalValue: s.value,
        isOverridden: hasOverride,
        label: s.label,
        group: s.group,
      };
    });
  }

  /**
   * Get the effective value of a single setting key for a specific branch.
   * This is the main cascade resolver used by other services (e.g., PricingService).
   *
   * Cascade: BranchSettingOverride.value ?? TenantSetting.value ?? defaultValue
   */
  async getEffectiveValue(
    connection: DataSource,
    key: string,
    branchId?: string,
    defaultValue = '',
  ): Promise<string> {
    // 1. Check branch override first
    if (branchId) {
      const overrideRepo = connection.getRepository(BranchSettingOverride);
      const override = await overrideRepo.findOne({
        where: { branch_id: branchId, key },
      });
      if (override) return override.value;
    }

    // 2. Fall back to global setting
    return this.getValue(connection, key, defaultValue);
  }

  // ─── Branch Override CRUD ──────────────────────────────────────

  /** Set a branch-specific override for a setting key */
  async setBranchOverride(
    connection: DataSource,
    branchId: string,
    key: string,
    value: string,
  ): Promise<BranchSettingOverride> {
    const repo = connection.getRepository(BranchSettingOverride);
    const existing = await repo.findOne({
      where: { branch_id: branchId, key },
    });

    if (existing) {
      existing.value = value;
      return repo.save(existing);
    }

    return repo.save(repo.create({ branch_id: branchId, key, value }));
  }

  /** Remove a branch override (revert to global default) */
  async removeBranchOverride(
    connection: DataSource,
    branchId: string,
    key: string,
  ): Promise<void> {
    const repo = connection.getRepository(BranchSettingOverride);
    await repo.delete({ branch_id: branchId, key });
  }

  /** Batch set branch overrides */
  async batchSetBranchOverrides(
    connection: DataSource,
    branchId: string,
    settings: { key: string; value: string }[],
  ): Promise<BranchSettingOverride[]> {
    const results: BranchSettingOverride[] = [];
    for (const s of settings) {
      results.push(await this.setBranchOverride(connection, branchId, s.key, s.value));
    }
    return results;
  }

  // ─── Global Save with Propagation ──────────────────────────────

  /**
   * Save global settings with propagation control.
   *
   * mode = 'default_only': Only update the global value. Branches with custom overrides keep their values.
   * mode = 'force_all': Update the global value AND delete all branch overrides for these keys.
   */
  async saveGlobalWithPropagation(
    connection: DataSource,
    settings: { key: string; value: string }[],
    mode: 'default_only' | 'force_all' = 'default_only',
  ): Promise<TenantSetting[]> {
    // 1. Update global settings
    const results = await this.batchUpsert(connection, settings);

    // 2. If force_all, delete all branch overrides for these keys
    if (mode === 'force_all') {
      const overrideRepo = connection.getRepository(BranchSettingOverride);
      const keys = settings.map((s) => s.key);
      for (const key of keys) {
        await overrideRepo.delete({ key });
      }
    }

    return results;
  }
}
