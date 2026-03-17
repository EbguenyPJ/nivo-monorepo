import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { Sale } from '@nivo/database';

@Injectable()
export class ReportsService {
  constructor(
    @InjectQueue('report-generation')
    private readonly reportQueue: Queue,
  ) {}

  async getSummary(
    connection: DataSource,
    startDate?: string,
    endDate?: string,
  ) {
    const saleRepo = connection.getRepository(Sale);

    const countQb = saleRepo.createQueryBuilder('sale').where('sale.status = :status', { status: 'completed' });
    const aggQb = saleRepo
      .createQueryBuilder('sale')
      .select('SUM(sale.total_amount)', 'total_revenue')
      .addSelect('AVG(sale.total_amount)', 'avg_ticket')
      .where('sale.status = :status', { status: 'completed' });

    if (startDate) {
      countQb.andWhere('sale.created_at >= :startDate', { startDate });
      aggQb.andWhere('sale.created_at >= :startDate', { startDate });
    }
    if (endDate) {
      countQb.andWhere('sale.created_at <= :endDate', { endDate });
      aggQb.andWhere('sale.created_at <= :endDate', { endDate });
    }

    const totalSales = await countQb.getCount();
    const result = await aggQb.getRawOne();

    return {
      total_sales: totalSales,
      total_revenue: parseFloat(result?.total_revenue || '0'),
      avg_ticket: parseFloat(result?.avg_ticket || '0'),
    };
  }

  async getSales(
    connection: DataSource,
    options: { startDate?: string; endDate?: string; limit?: number; offset?: number },
  ) {
    const saleRepo = connection.getRepository(Sale);
    const qb = saleRepo
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.employee', 'employee')
      .leftJoinAndSelect('sale.branch', 'branch')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.items', 'items')
      .orderBy('sale.created_at', 'DESC');

    if (options.startDate) {
      qb.andWhere('sale.created_at >= :startDate', { startDate: options.startDate });
    }
    if (options.endDate) {
      qb.andWhere('sale.created_at <= :endDate', { endDate: options.endDate });
    }

    const limit = options.limit || 20;
    const offset = options.offset || 0;
    qb.take(limit).skip(offset);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async enqueueExport(tenant: any) {
    await this.reportQueue.add('generate-report', {
      database_name: tenant.database_name,
      report_type: 'sales-csv',
      tenant_id: tenant.id,
    });

    return { message: 'Report generation queued. You will be notified when ready.' };
  }
}
