import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TenantConnectionManager } from '../../../core/database/tenant-connection.manager';

@Processor('report-generation')
export class ReportGeneratorWorker extends WorkerHost {
  private readonly logger = new Logger(ReportGeneratorWorker.name);

  constructor(private readonly connectionManager: TenantConnectionManager) {
    super();
  }

  async process(job: Job) {
    const { database_name, report_type } = job.data;
    this.logger.log(`Generating ${report_type} report for ${database_name}`);

    try {
      const connection = await this.connectionManager.getConnection(database_name);
      const saleRepo = connection.getRepository('Sale');

      const sales = await saleRepo.find({
        relations: ['items'],
        order: { created_at: 'DESC' },
      });

      // TODO: Generate CSV/Excel and upload to S3/R2
      this.logger.log(`Report generated with ${sales.length} sales records`);

      return { sales_count: sales.length, status: 'completed' };
    } catch (error) {
      this.logger.error(`Report generation failed:`, error);
      throw error;
    }
  }
}
