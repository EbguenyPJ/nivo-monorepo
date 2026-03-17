import { Module } from '@nestjs/common';
import { TenantProvisioningWorker } from './tenant-provisioning.worker';
import { ReportGeneratorWorker } from './report-generator.worker';

@Module({
  providers: [TenantProvisioningWorker, ReportGeneratorWorker],
})
export class JobsModule {}
