import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TenantConnectionManager } from '../../../core/database/tenant-connection.manager';
import { SYSTEM_PERMISSIONS, DEFAULT_ROLES } from './rbac-seed';

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

      // ─── 1. Seed RBAC: Permissions ──────────────────────────
      const permissionRepo = connection.getRepository('Permission');
      const savedPermissions = await permissionRepo.save(
        SYSTEM_PERMISSIONS.map((p) => ({
          key: p.key,
          name: p.name,
          module: p.module,
          submodule: p.submodule || null,
          sort_order: p.sort_order,
        })),
      );

      // Build key → id map
      const permKeyToId = new Map<string, string>();
      for (const p of savedPermissions as any[]) {
        permKeyToId.set(p.key, p.id);
      }

      // ─── 2. Seed RBAC: Roles + role_has_permissions ─────────
      const roleRepo = connection.getRepository('Role');
      const rolePermRepo = connection.getRepository('RolePermission');
      const roleIdMap = new Map<string, string>();

      for (const roleDef of DEFAULT_ROLES) {
        const savedRole = await roleRepo.save({
          slug: roleDef.slug,
          name: roleDef.name,
          description: roleDef.description,
          is_system: true,
        });
        roleIdMap.set(roleDef.slug, (savedRole as any).id);

        // Assign permissions to role
        const rolePerms = roleDef.permissions
          .filter((key) => permKeyToId.has(key))
          .map((key) => ({
            role_id: (savedRole as any).id,
            permission_id: permKeyToId.get(key)!,
          }));

        if (rolePerms.length > 0) {
          await rolePermRepo.save(rolePerms);
        }
      }

      // ─── 3. Seed default branch ────────────────────────────
      const branchRepo = connection.getRepository('Branch');
      await branchRepo.save({ name: 'Sucursal Principal', code: 'PRINCIPAL', is_active: true });

      // ─── 4. Seed admin employee (linked to admin role) ─────
      const adminRoleId = roleIdMap.get('admin');
      const employeeRepo = connection.getRepository('Employee');
      await employeeRepo.save({
        name: 'Administrador',
        email: owner_email,
        password_hash: passwordHash,
        role: 'admin',
        role_id: adminRoleId || null,
        is_active: true,
      });

      // ─── 5. Seed default catalogs ──────────────────────────
      const paymentMethodRepo = connection.getRepository('PaymentMethod');
      await paymentMethodRepo.save([
        { name: 'Efectivo', requires_reference: false, is_active: true },
        { name: 'Tarjeta de Débito', requires_reference: true, is_active: true },
        { name: 'Tarjeta de Crédito', requires_reference: true, is_active: true },
        { name: 'Transferencia Bancaria', requires_reference: true, is_active: true },
      ]);

      const taxRepo = connection.getRepository('Tax');
      await taxRepo.save([
        { name: 'IVA 16%', percentage: 16.0, is_active: true },
        { name: 'IVA 8%', percentage: 8.0, is_active: true },
        { name: 'Exento', percentage: 0.0, is_active: true },
      ]);

      const cancellationReasonRepo = connection.getRepository('CancellationReason');
      await cancellationReasonRepo.save([
        { name: 'Cliente cambió de opinión', is_active: true },
        { name: 'Producto defectuoso', is_active: true },
        { name: 'Error en el pedido', is_active: true },
        { name: 'Producto no disponible', is_active: true },
        { name: 'Otro', is_active: true },
      ]);

      const unitOfMeasureRepo = connection.getRepository('UnitOfMeasure');
      await unitOfMeasureRepo.save([
        { name: 'Pieza', abbreviation: 'pz', is_active: true },
        { name: 'Par', abbreviation: 'par', is_active: true },
        { name: 'Caja', abbreviation: 'cja', is_active: true },
        { name: 'Kilogramo', abbreviation: 'kg', is_active: true },
      ]);

      this.logger.log(`Default data seeded for ${database_name}`);
      return { status: 'completed', database_name };
    } catch (error) {
      this.logger.error(`Failed to provision ${database_name}:`, error);
      throw error;
    }
  }
}
