import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  Brand,
  Category,
  Collection,
  CollectionProduct,
  Color,
  Branch,
  Product,
  ProductVariant,
  Inventory,
  Employee,
  Permission,
  Role,
  RolePermission,
  EmployeePermission,
  PosSession,
  Customer,
  Sale,
  SaleItem,
  SalePayment,
  PaymentMethod,
  Tax,
  CancellationReason,
  UnitOfMeasure,
  SizeGroup,
  SizeSystem,
  Size,
  SizeEquivalency,
  TenantSetting,
  PriceList,
  BranchVariantOverride,
  VariantPriceMargin,
  BranchSettingOverride,
  StorageLocation,
  InventoryLocation,
  CustomerAddress,
  CashRegister,
  CashTransaction,
  SaleReturn,
  SaleReturnItem,
  InventoryTransfer,
  InventoryTransferItem,
  InventoryAudit,
  InventoryAuditItem,
  InventoryAdjustment,
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  AccountPayable,
  BranchRoleEmployee,
} from '@nivo/database';

const TENANT_ENTITIES = [
  Brand,
  Category,
  Collection,
  CollectionProduct,
  Color,
  Branch,
  Product,
  ProductVariant,
  Inventory,
  Employee,
  Permission,
  Role,
  RolePermission,
  EmployeePermission,
  PosSession,
  Customer,
  Sale,
  SaleItem,
  SalePayment,
  PaymentMethod,
  Tax,
  CancellationReason,
  UnitOfMeasure,
  SizeGroup,
  SizeSystem,
  Size,
  SizeEquivalency,
  TenantSetting,
  PriceList,
  BranchVariantOverride,
  VariantPriceMargin,
  BranchSettingOverride,
  StorageLocation,
  InventoryLocation,
  CustomerAddress,
  CashRegister,
  CashTransaction,
  SaleReturn,
  SaleReturnItem,
  InventoryTransfer,
  InventoryTransferItem,
  InventoryAudit,
  InventoryAuditItem,
  InventoryAdjustment,
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  AccountPayable,
  BranchRoleEmployee,
];

@Injectable()
export class TenantConnectionManager implements OnModuleDestroy {
  private connections = new Map<string, DataSource>();

  constructor(private readonly config: ConfigService) {}

  async getConnection(databaseName: string): Promise<DataSource> {
    if (this.connections.has(databaseName)) {
      const existing = this.connections.get(databaseName)!;
      if (existing.isInitialized) {
        return existing;
      }
    }

    const dataSource = new DataSource({
      type: 'postgres',
      host: this.config.get('TENANT_DB_HOST', 'localhost'),
      port: this.config.get<number>('TENANT_DB_PORT', 5432),
      username: this.config.get('TENANT_DB_USERNAME', 'nivo_admin'),
      password: this.config.get('TENANT_DB_PASSWORD', 'nivo_secret_2024'),
      database: databaseName,
      entities: TENANT_ENTITIES,
      synchronize: this.config.get('NODE_ENV') === 'development',
      logging: false,
    });

    await dataSource.initialize();
    this.connections.set(databaseName, dataSource);
    return dataSource;
  }

  async createTenantDatabase(databaseName: string): Promise<void> {
    const adminSource = new DataSource({
      type: 'postgres',
      host: this.config.get('TENANT_DB_HOST', 'localhost'),
      port: this.config.get<number>('TENANT_DB_PORT', 5432),
      username: this.config.get('TENANT_DB_USERNAME', 'nivo_admin'),
      password: this.config.get('TENANT_DB_PASSWORD', 'nivo_secret_2024'),
      database: 'postgres',
    });

    await adminSource.initialize();
    await adminSource.query(`CREATE DATABASE "${databaseName}"`);
    await adminSource.destroy();

    // Initialize tenant schema
    const tenantSource = await this.getConnection(databaseName);
    await tenantSource.synchronize();
  }

  async onModuleDestroy() {
    for (const [, connection] of this.connections) {
      if (connection.isInitialized) {
        await connection.destroy();
      }
    }
    this.connections.clear();
  }
}
