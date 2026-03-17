import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Customer } from '@nivo/database';

@Injectable()
export class CustomersService {
  async findAll(connection: DataSource, search?: string) {
    const repo = connection.getRepository(Customer);

    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      return repo
        .createQueryBuilder('customer')
        .where('LOWER(customer.name) LIKE :q', { q })
        .orWhere('LOWER(customer.email) LIKE :q', { q })
        .orWhere('customer.phone LIKE :q', { q })
        .orderBy('customer.name', 'ASC')
        .take(20)
        .getMany();
    }

    return repo.find({ order: { created_at: 'DESC' } });
  }

  async create(connection: DataSource, data: any) {
    const repo = connection.getRepository(Customer);
    const customer = repo.create({ name: data.name, email: data.email, phone: data.phone });
    return repo.save(customer);
  }

  async redeemPoints(connection: DataSource, data: { customer_id: string; points: number }) {
    const repo = connection.getRepository(Customer);
    const customer = await repo.findOne({ where: { id: data.customer_id } });
    if (!customer) throw new NotFoundException('Customer not found');
    if (customer.loyalty_points < data.points) throw new BadRequestException('Insufficient points');

    customer.loyalty_points -= data.points;
    return repo.save(customer);
  }
}
