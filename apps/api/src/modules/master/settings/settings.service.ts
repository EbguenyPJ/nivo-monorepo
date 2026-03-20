import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanConfig, SystemSetting } from '@nivo/database';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(PlanConfig)
    private readonly planConfigRepo: Repository<PlanConfig>,
    @InjectRepository(SystemSetting)
    private readonly systemSettingRepo: Repository<SystemSetting>,
  ) {}

  async getPlans() {
    return this.planConfigRepo.find({ order: { price: 'ASC' } });
  }

  async updatePlan(id: string, data: Partial<PlanConfig>) {
    const plan = await this.planConfigRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    Object.assign(plan, data);
    return this.planConfigRepo.save(plan);
  }

  async getSettings(category?: string) {
    const where = category ? { category } : {};
    const settings = await this.systemSettingRepo.find({ where, order: { category: 'ASC', key: 'ASC' } });

    return settings.map((s) => ({
      ...s,
      value: s.is_secret ? '********' : s.value,
    }));
  }

  async updateSetting(key: string, value: string) {
    const setting = await this.systemSettingRepo.findOne({ where: { key } });
    if (!setting) throw new NotFoundException(`Setting "${key}" not found`);
    setting.value = value;
    return this.systemSettingRepo.save(setting);
  }

  async bulkUpdateSettings(items: { key: string; value: string }[]) {
    const results: SystemSetting[] = [];
    for (const item of items) {
      const setting = await this.systemSettingRepo.findOne({ where: { key: item.key } });
      if (setting) {
        setting.value = item.value;
        results.push(await this.systemSettingRepo.save(setting));
      }
    }
    return results;
  }
}
