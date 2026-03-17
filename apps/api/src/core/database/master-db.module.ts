import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Tenant, Subscription, SuperAdmin } from '@nivo/database';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('MASTER_DB_HOST', 'localhost'),
        port: config.get<number>('MASTER_DB_PORT', 5432),
        username: config.get('MASTER_DB_USERNAME', 'nivo_admin'),
        password: config.get('MASTER_DB_PASSWORD', 'nivo_secret_2024'),
        database: config.get('MASTER_DB_NAME', 'nivo_master_db'),
        entities: [Tenant, Subscription, SuperAdmin],
        synchronize: config.get('NODE_ENV') === 'development',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
    TypeOrmModule.forFeature([Tenant, Subscription, SuperAdmin]),
  ],
  exports: [TypeOrmModule],
})
export class MasterDbModule {}
