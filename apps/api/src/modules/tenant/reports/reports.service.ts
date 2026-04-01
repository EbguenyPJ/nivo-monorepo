import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { Sale, Branch, Employee } from '@nivo/database';

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
    branchId?: string,
  ) {
    const saleRepo = connection.getRepository(Sale);

    const countQb = saleRepo.createQueryBuilder('sale').where('sale.status = :status', { status: 'completed' });
    const aggQb = saleRepo
      .createQueryBuilder('sale')
      .select('SUM(sale.total_amount)', 'total_revenue')
      .addSelect('AVG(sale.total_amount)', 'avg_ticket')
      .where('sale.status = :status', { status: 'completed' });

    if (branchId) {
      countQb.andWhere('sale.branch_id = :branchId', { branchId });
      aggQb.andWhere('sale.branch_id = :branchId', { branchId });
    }
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
    options: { startDate?: string; endDate?: string; limit?: number; offset?: number; branchId?: string },
  ) {
    const saleRepo = connection.getRepository(Sale);
    const qb = saleRepo
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.employee', 'employee')
      .leftJoinAndSelect('sale.branch', 'branch')
      .leftJoinAndSelect('sale.customer', 'customer')
      .leftJoinAndSelect('sale.items', 'items')
      .orderBy('sale.created_at', 'DESC');

    if (options.branchId) {
      qb.andWhere('sale.branch_id = :branchId', { branchId: options.branchId });
    }
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

  async getDailySales(
    connection: DataSource,
    startDate?: string,
    endDate?: string,
    branchId?: string,
  ) {
    const saleRepo = connection.getRepository(Sale);
    const qb = saleRepo
      .createQueryBuilder('sale')
      .select("DATE(sale.created_at)", 'date')
      .addSelect('COUNT(sale.id)', 'count')
      .addSelect('SUM(sale.total_amount)', 'revenue')
      .where('sale.status = :status', { status: 'completed' })
      .groupBy("DATE(sale.created_at)")
      .orderBy("DATE(sale.created_at)", 'ASC');

    if (branchId) {
      qb.andWhere('sale.branch_id = :branchId', { branchId });
    }
    if (startDate) {
      qb.andWhere('sale.created_at >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('sale.created_at <= :endDate', { endDate });
    }

    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      date: r.date,
      count: parseInt(r.count, 10),
      revenue: parseFloat(r.revenue || '0'),
    }));
  }

  /**
   * Cross-branch comparison for the General dashboard.
   * Returns per-branch KPIs: revenue, sales count, avg ticket, employee count.
   */
  async getBranchComparison(
    connection: DataSource,
    startDate?: string,
    endDate?: string,
  ) {
    const saleRepo = connection.getRepository(Sale);
    const branchRepo = connection.getRepository(Branch);
    const employeeRepo = connection.getRepository(Employee);

    // Get all active branches
    const branches = await branchRepo.find({ where: { is_active: true }, order: { name: 'ASC' } });

    // Sales aggregation per branch
    const salesQb = saleRepo
      .createQueryBuilder('sale')
      .select('sale.branch_id', 'branch_id')
      .addSelect('COUNT(sale.id)', 'total_sales')
      .addSelect('SUM(sale.total_amount)', 'total_revenue')
      .addSelect('AVG(sale.total_amount)', 'avg_ticket')
      .where('sale.status = :status', { status: 'completed' })
      .groupBy('sale.branch_id');

    if (startDate) salesQb.andWhere('sale.created_at >= :startDate', { startDate });
    if (endDate) salesQb.andWhere('sale.created_at <= :endDate', { endDate });

    const salesRows = await salesQb.getRawMany();
    const salesMap = new Map(salesRows.map((r) => [r.branch_id, r]));

    // Employee count per branch
    const empCounts = await employeeRepo
      .createQueryBuilder('emp')
      .select('emp.branch_id', 'branch_id')
      .addSelect('COUNT(emp.id)', 'count')
      .where('emp.is_active = :active', { active: true })
      .groupBy('emp.branch_id')
      .getRawMany();
    const empMap = new Map(empCounts.map((r) => [r.branch_id, parseInt(r.count, 10)]));

    return {
      branches: branches.map((b) => {
        const sales = salesMap.get(b.id);
        return {
          branch_id: b.id,
          branch_name: b.name,
          total_revenue: parseFloat(sales?.total_revenue || '0'),
          total_sales: parseInt(sales?.total_sales || '0', 10),
          avg_ticket: parseFloat(sales?.avg_ticket || '0'),
          employee_count: empMap.get(b.id) || 0,
        };
      }),
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
