import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';

@Injectable()
export class ReportsService {
  constructor(
    @InjectQueue('report-generation')
    private readonly reportQueue: Queue,
  ) {}

  async getSummary(connection: DataSource) {
    const saleRepo = connection.getRepository('Sale');

    const totalSales = await saleRepo.count({ where: { status: 'completed' } });
    const result = await saleRepo
      .createQueryBuilder('sale')
      .select('SUM(sale.total_amount)', 'total_revenue')
      .addSelect('AVG(sale.total_amount)', 'avg_ticket')
      .where('sale.status = :status', { status: 'completed' })
      .getRawOne();

    return {
      total_sales: totalSales,
      total_revenue: parseFloat(result?.total_revenue || '0'),
      avg_ticket: parseFloat(result?.avg_ticket || '0'),
    };
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
