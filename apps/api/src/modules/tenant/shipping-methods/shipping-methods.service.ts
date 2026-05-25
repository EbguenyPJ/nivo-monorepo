import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ShippingMethod } from '@nivo/database';

@Injectable()
export class ShippingMethodsService {
  async findAll(conn: DataSource) {
    return conn.getRepository(ShippingMethod).find({ where: { is_active: true }, order: { name: 'ASC' } });
  }

  async findAllAdmin(conn: DataSource) {
    return conn.getRepository(ShippingMethod).find({ order: { name: 'ASC' } });
  }

  async create(conn: DataSource, dto: Partial<ShippingMethod>) {
    const repo = conn.getRepository(ShippingMethod);
    return repo.save(repo.create(dto));
  }

  async update(conn: DataSource, id: string, dto: Partial<ShippingMethod>) {
    const repo = conn.getRepository(ShippingMethod);
    await repo.update(id, dto);
    return repo.findOneByOrFail({ id });
  }

  async calculate(conn: DataSource, subtotal: number) {
    const methods = await this.findAll(conn);
    return methods.map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      estimated_days_min: m.estimated_days_min,
      estimated_days_max: m.estimated_days_max,
      cost: m.free_above && subtotal >= Number(m.free_above) ? 0 : Number(m.base_cost),
    }));
  }
}
