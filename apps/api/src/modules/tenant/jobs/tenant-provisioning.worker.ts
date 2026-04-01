import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TenantConnectionManager } from '../../../core/database/tenant-connection.manager';
import { SYSTEM_PERMISSIONS, DEFAULT_ROLES } from './rbac-seed';
import { DEFAULT_TENANT_SETTINGS } from '../tenant-settings/tenant-settings.service';

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
      const mainBranch = await branchRepo.save({ name: 'Sucursal Principal', code: 'PRINCIPAL', is_active: true }) as any;

      // ─── 3b. Seed default storage locations ────────────────
      const locationRepo = connection.getRepository('StorageLocation');
      const aisle1 = await locationRepo.save({
        branch_id: mainBranch.id,
        parent_id: null,
        name: 'Pasillo A',
        code: 'A',
        type: 'aisle',
        is_active: true,
      }) as any;
      await locationRepo.save([
        { branch_id: mainBranch.id, parent_id: aisle1.id, name: 'Estante A-1', code: 'A-1', type: 'shelf', is_active: true },
        { branch_id: mainBranch.id, parent_id: aisle1.id, name: 'Estante A-2', code: 'A-2', type: 'shelf', is_active: true },
        { branch_id: mainBranch.id, parent_id: aisle1.id, name: 'Estante A-3', code: 'A-3', type: 'shelf', is_active: true },
      ]);

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

      // ─── 6. Seed default colors (global) ────────────────────
      const colorRepo = connection.getRepository('Color');
      await colorRepo.save([
        { name: 'Blanco', hex_code: '#FFFFFF', branch_id: null, is_active: true },
        { name: 'Negro', hex_code: '#000000', branch_id: null, is_active: true },
        { name: 'Rojo', hex_code: '#EF4444', branch_id: null, is_active: true },
        { name: 'Azul', hex_code: '#3B82F6', branch_id: null, is_active: true },
        { name: 'Azul Marino', hex_code: '#1E3A5F', branch_id: null, is_active: true },
        { name: 'Verde', hex_code: '#22C55E', branch_id: null, is_active: true },
        { name: 'Amarillo', hex_code: '#EAB308', branch_id: null, is_active: true },
        { name: 'Rosa', hex_code: '#EC4899', branch_id: null, is_active: true },
        { name: 'Fiusha', hex_code: '#FF00FF', branch_id: null, is_active: true },
        { name: 'Café', hex_code: '#92400E', branch_id: null, is_active: true },
        { name: 'Beige', hex_code: '#D2B48C', branch_id: null, is_active: true },
        { name: 'Gris', hex_code: '#6B7280', branch_id: null, is_active: true },
        { name: 'Naranja', hex_code: '#F97316', branch_id: null, is_active: true },
        { name: 'Morado', hex_code: '#8B5CF6', branch_id: null, is_active: true },
        { name: 'Vino', hex_code: '#7F1D1D', branch_id: null, is_active: true },
      ]);

      // ─── 7. Seed size groups, systems & equivalencies ────────
      const sizeGroupRepo = connection.getRepository('SizeGroup');
      const sizeSystemRepo = connection.getRepository('SizeSystem');
      const sizeRepo = connection.getRepository('Size');
      const sizeEqRepo = connection.getRepository('SizeEquivalency');

      const hombreGroup = await sizeGroupRepo.save({ name: 'Hombre', is_active: true });
      const mujerGroup = await sizeGroupRepo.save({ name: 'Mujer', is_active: true });

      const mexSystem = await sizeSystemRepo.save({ name: 'MEX', is_active: true });
      const usSystem = await sizeSystemRepo.save({ name: 'US', is_active: true });
      const eurSystem = await sizeSystemRepo.save({ name: 'EUR', is_active: true });

      // Hombre: 25–30 MEX
      const hombreMatrix = [
        { mex: '25', us: '7', eur: '39' },
        { mex: '25.5', us: '7.5', eur: '39.5' },
        { mex: '26', us: '8', eur: '40' },
        { mex: '26.5', us: '8.5', eur: '41' },
        { mex: '27', us: '9', eur: '42' },
        { mex: '27.5', us: '9.5', eur: '42.5' },
        { mex: '28', us: '10', eur: '43' },
        { mex: '28.5', us: '10.5', eur: '44' },
        { mex: '29', us: '11', eur: '44.5' },
        { mex: '29.5', us: '11.5', eur: '45' },
        { mex: '30', us: '12', eur: '46' },
      ];

      for (let i = 0; i < hombreMatrix.length; i++) {
        const row = hombreMatrix[i];
        const size = await sizeRepo.save({ size_group_id: (hombreGroup as any).id, order_index: i });
        await sizeEqRepo.save([
          { size_id: (size as any).id, size_system_id: (mexSystem as any).id, value: row.mex },
          { size_id: (size as any).id, size_system_id: (usSystem as any).id, value: row.us },
          { size_id: (size as any).id, size_system_id: (eurSystem as any).id, value: row.eur },
        ]);
      }

      // Mujer: 22–27 MEX
      const mujerMatrix = [
        { mex: '22', us: '5', eur: '35' },
        { mex: '22.5', us: '5.5', eur: '35.5' },
        { mex: '23', us: '6', eur: '36' },
        { mex: '23.5', us: '6.5', eur: '36.5' },
        { mex: '24', us: '7', eur: '37' },
        { mex: '24.5', us: '7.5', eur: '38' },
        { mex: '25', us: '8', eur: '38.5' },
        { mex: '25.5', us: '8.5', eur: '39' },
        { mex: '26', us: '9', eur: '40' },
        { mex: '26.5', us: '9.5', eur: '40.5' },
        { mex: '27', us: '10', eur: '41' },
      ];

      for (let i = 0; i < mujerMatrix.length; i++) {
        const row = mujerMatrix[i];
        const size = await sizeRepo.save({ size_group_id: (mujerGroup as any).id, order_index: i });
        await sizeEqRepo.save([
          { size_id: (size as any).id, size_system_id: (mexSystem as any).id, value: row.mex },
          { size_id: (size as any).id, size_system_id: (usSystem as any).id, value: row.us },
          { size_id: (size as any).id, size_system_id: (eurSystem as any).id, value: row.eur },
        ]);
      }

      // ─── 8. Seed default tenant settings ─────────────────────
      // Uses the centralized DEFAULT_TENANT_SETTINGS constant from tenant-settings.service.
      // BranchSettingOverride entries are NOT seeded here — they are created on-demand
      // from the Settings UI when a user customizes a value for a specific branch.
      // New tenants start with all branches inheriting global defaults (no overrides).
      const settingsRepo = connection.getRepository('TenantSetting');
      await settingsRepo.save(
        DEFAULT_TENANT_SETTINGS.map((s) => ({
          key: s.key,
          value: s.value,
          label: s.label || null,
          group: s.group || null,
        })),
      );

      // ─── 9. Seed default price list ─────────────────────────
      const priceListRepo = connection.getRepository('PriceList');
      await priceListRepo.save([
        { name: 'Público General', default_margin_percentage: 30, is_default: true, is_active: true },
        { name: 'Mayoreo', default_margin_percentage: 15, is_default: false, is_active: true },
      ]);

      this.logger.log(`Default data seeded for ${database_name}`);
      return { status: 'completed', database_name };
    } catch (error) {
      this.logger.error(`Failed to provision ${database_name}:`, error);
      throw error;
    }
  }
}
