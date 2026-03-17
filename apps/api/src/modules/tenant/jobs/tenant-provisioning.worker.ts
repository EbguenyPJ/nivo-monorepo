import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TenantConnectionManager } from '../../../core/database/tenant-connection.manager';

@Processor('tenant-provisioning')
export class TenantProvisioningWorker extends WorkerHost {
  private readonly logger = new Logger(TenantProvisioningWorker.name);

  constructor(private readonly connectionManager: TenantConnectionManager) {
    super();
  }

  async process(job: Job) {
    const { database_name, owner_email, owner_password } = job.data;
    this.logger.log(`Provisioning tenant database: ${database_name}`);

    try {
      await this.connectionManager.createTenantDatabase(database_name);
      this.logger.log(`Database ${database_name} provisioned successfully`);

      const connection = await this.connectionManager.getConnection(database_name);
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash(owner_password, 12);

      const employeeRepo = connection.getRepository('Employee');
      await employeeRepo.save({
        name: 'Administrador',
        email: owner_email,
        password_hash: passwordHash,
        role: 'admin',
        is_active: true,
      });

      const branchRepo = connection.getRepository('Branch');
      await branchRepo.save({ name: 'Sucursal Principal' });

      this.logger.log(`Default data seeded for ${database_name}`);
      return { status: 'completed', database_name };
    } catch (error) {
      this.logger.error(`Failed to provision ${database_name}:`, error);
      throw error;
    }
  }
}
