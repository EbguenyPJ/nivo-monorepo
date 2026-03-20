import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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

  // ---- Plans ----

  async getPlans() {
    const plans = await this.planConfigRepo.find({ order: { sort_order: 'ASC', monthly_price: 'ASC' } });
    return { data: plans };
  }

  async getPlanById(id: string) {
    const plan = await this.planConfigRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async createPlan(data: Partial<PlanConfig>) {
    // Check unique plan_name
    if (data.plan_name) {
      const existing = await this.planConfigRepo.findOne({ where: { plan_name: data.plan_name } });
      if (existing) throw new ConflictException(`Plan with name "${data.plan_name}" already exists`);
    }
    const plan = this.planConfigRepo.create(data);
    return this.planConfigRepo.save(plan);
  }

  async updatePlan(id: string, data: Partial<PlanConfig>) {
    const plan = await this.planConfigRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    Object.assign(plan, data);
    return this.planConfigRepo.save(plan);
  }

  async deletePlan(id: string) {
    const plan = await this.planConfigRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    await this.planConfigRepo.remove(plan);
    return { deleted: true };
  }

  // ---- System Settings ----

  async getSettings(category?: string) {
    const where = category ? { category } : {};
    const settings = await this.systemSettingRepo.find({ where, order: { category: 'ASC', key: 'ASC' } });

    const data = settings.map((s) => ({
      ...s,
      value: s.is_secret ? '********' : s.value,
    }));
    return { data };
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
