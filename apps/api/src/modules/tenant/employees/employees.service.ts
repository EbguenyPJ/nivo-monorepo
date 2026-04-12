import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  Employee, Role, Permission, RolePermission, EmployeePermission,
  BranchRoleEmployee, Branch,
} from '@nivo/database';

// ═══════════════════════════════════════════════════════════════════
//  Default permissions catalog — seeded on first access
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_PERMISSIONS: { key: string; name: string; module: string; submodule?: string; sort: number }[] = [
  // Punto de Venta
  { key: 'pos.sell', name: 'Cobrar ventas', module: 'Punto de Venta', sort: 1 },
  { key: 'pos.apply_discount', name: 'Aplicar descuentos manuales', module: 'Punto de Venta', sort: 2 },
  { key: 'pos.void_item', name: 'Cancelar artículos del ticket', module: 'Punto de Venta', sort: 3 },
  { key: 'pos.void_sale', name: 'Cancelar tickets completos', module: 'Punto de Venta', sort: 4 },
  { key: 'pos.open_drawer', name: 'Abrir cajón sin venta', module: 'Punto de Venta', sort: 5 },
  { key: 'pos.process_return', name: 'Procesar devoluciones', module: 'Punto de Venta', sort: 6 },
  { key: 'pos.view_sales', name: 'Ver historial de ventas', module: 'Punto de Venta', sort: 7 },
  { key: 'pos.reprint_receipt', name: 'Reimprimir tickets', module: 'Punto de Venta', sort: 8 },
  // Caja
  { key: 'cash.open_session', name: 'Abrir sesión de caja', module: 'Caja', sort: 1 },
  { key: 'cash.close_session', name: 'Cerrar sesión (Corte Z)', module: 'Caja', sort: 2 },
  { key: 'cash.view_audit', name: 'Ver arqueos y cortes', module: 'Caja', sort: 3 },
  { key: 'cash.vault_withdrawal', name: 'Retiros a bóveda', module: 'Caja', sort: 4 },
  // Inventario
  { key: 'inventory.view_stock', name: 'Ver stock por sucursal', module: 'Inventario', sort: 1 },
  { key: 'inventory.adjust_stock', name: 'Ajustar niveles de stock', module: 'Inventario', sort: 2 },
  { key: 'inventory.create_transfer', name: 'Crear traspasos', module: 'Inventario', sort: 3 },
  { key: 'inventory.dispatch_transfer', name: 'Despachar traspasos', module: 'Inventario', sort: 4 },
  { key: 'inventory.receive_transfer', name: 'Recibir traspasos', module: 'Inventario', sort: 5 },
  { key: 'inventory.manage_locations', name: 'Gestionar ubicaciones', module: 'Inventario', sort: 6 },
  // Auditorías
  { key: 'audit.create', name: 'Crear auditorías', module: 'Auditorías', sort: 1 },
  { key: 'audit.count', name: 'Participar en conteo', module: 'Auditorías', sort: 2 },
  { key: 'audit.review', name: 'Revisar discrepancias', module: 'Auditorías', sort: 3 },
  { key: 'audit.close', name: 'Cerrar y aplicar auditorías', module: 'Auditorías', sort: 4 },
  // Compras
  { key: 'purchasing.manage_suppliers', name: 'Gestionar proveedores', module: 'Compras', sort: 1 },
  { key: 'purchasing.create_order', name: 'Crear órdenes de compra', module: 'Compras', sort: 2 },
  { key: 'purchasing.receive_order', name: 'Recibir mercancía', module: 'Compras', sort: 3 },
  { key: 'purchasing.manage_payables', name: 'Gestionar cuentas por pagar', module: 'Compras', sort: 4 },
  // Catálogo
  { key: 'catalog.view', name: 'Ver catálogo de productos', module: 'Catálogo', sort: 1 },
  { key: 'catalog.edit', name: 'Editar productos y variantes', module: 'Catálogo', sort: 2 },
  { key: 'catalog.manage_pricing', name: 'Gestionar precios y márgenes', module: 'Catálogo', sort: 3 },
  // Clientes
  { key: 'customers.view', name: 'Ver directorio de clientes', module: 'Clientes', sort: 1 },
  { key: 'customers.edit', name: 'Editar clientes', module: 'Clientes', sort: 2 },
  // Reportes
  { key: 'reports.view_branch', name: 'Ver reportes de sucursal', module: 'Reportes', sort: 1 },
  { key: 'reports.view_global', name: 'Ver reportes globales', module: 'Reportes', sort: 2 },
  // Seguridad
  { key: 'security.manage_employees', name: 'Gestionar empleados', module: 'Seguridad', sort: 1 },
  { key: 'security.manage_roles', name: 'Gestionar roles y permisos', module: 'Seguridad', sort: 2 },
  { key: 'security.manager_override', name: 'Autorizar acciones restringidas (PIN)', module: 'Seguridad', sort: 3 },
  // Configuración
  { key: 'settings.view', name: 'Ver configuración', module: 'Configuración', sort: 1 },
  { key: 'settings.edit', name: 'Editar configuración del tenant', module: 'Configuración', sort: 2 },
  { key: 'settings.manage_branches', name: 'Gestionar sucursales', module: 'Configuración', sort: 3 },
];

@Injectable()
export class EmployeesService {
  // ═══════════════════════════════════════════════════════════════════
  //  SEED PERMISSIONS — ensures all permissions exist in DB
  // ═══════════════════════════════════════════════════════════════════

  async seedPermissions(connection: DataSource) {
    const repo = connection.getRepository(Permission);
    for (const p of DEFAULT_PERMISSIONS) {
      const existing = await repo.findOne({ where: { key: p.key } });
      if (!existing) {
        await repo.save(repo.create({
          key: p.key,
          name: p.name,
          module: p.module,
          submodule: p.submodule || null,
          sort_order: p.sort,
        }));
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  EMPLOYEES — CRUD
  // ═══════════════════════════════════════════════════════════════════

  async findAll(connection: DataSource, branchId?: string) {
    const repo = connection.getRepository(Employee);
    const qb = repo.createQueryBuilder('e')
      .leftJoinAndSelect('e.branch', 'branch')
      .leftJoinAndSelect('e.roleEntity', 'role')
      .leftJoinAndSelect('e.branch_roles', 'bre')
      .leftJoinAndSelect('bre.branch', 'breBranch')
      .leftJoinAndSelect('bre.role', 'breRole');

    if (branchId) {
      // Show employees that have this branch as home OR have a branch_role here
      qb.where('e.branch_id = :bid OR bre.branch_id = :bid', { bid: branchId });
    }

    qb.orderBy('e.created_at', 'ASC');
    const employees = await qb.getMany();

    return employees.map(({ password_hash, pin_hash, ...emp }) => ({
      ...emp,
      branch_assignments: (emp.branch_roles || []).map((bre) => ({
        branch_id: bre.branch_id,
        branch_name: bre.branch?.name || '',
        role_id: bre.role_id,
        role_name: bre.role?.name || '',
      })),
    }));
  }

  async findOne(connection: DataSource, id: string) {
    const repo = connection.getRepository(Employee);
    const employee = await repo.findOne({
      where: { id },
      relations: ['branch', 'roleEntity', 'branch_roles', 'branch_roles.branch', 'branch_roles.role'],
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado');
    const { password_hash, pin_hash, ...result } = employee;
    return {
      ...result,
      branch_assignments: (result.branch_roles || []).map((bre) => ({
        branch_id: bre.branch_id,
        branch_name: bre.branch?.name || '',
        role_id: bre.role_id,
        role_name: bre.role?.name || '',
      })),
    };
  }

  async create(connection: DataSource, data: any) {
    const repo = connection.getRepository(Employee);

    if (!data.name?.trim()) throw new BadRequestException('El nombre es obligatorio');
    if (!data.email?.trim()) throw new BadRequestException('El correo es obligatorio');
    if (!data.password || data.password.length < 8)
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');

    const existing = await repo.findOne({ where: { email: data.email.trim().toLowerCase() } });
    if (existing) throw new ConflictException('Este correo electrónico ya está en uso');

    // PIN uniqueness
    let pinHash: string | null = null;
    if (data.pin) {
      if (!/^\d{4,6}$/.test(data.pin))
        throw new BadRequestException('El PIN debe ser de 4 a 6 dígitos numéricos');
      await this.validatePinUniqueness(connection, data.pin, null);
      pinHash = await bcrypt.hash(data.pin, 10);
    }

    // Resolve role for legacy column
    const roleRepo = connection.getRepository(Role);
    let legacyRole = 'cashier';
    if (data.role_id) {
      const role = await roleRepo.findOne({ where: { id: data.role_id } });
      if (role) legacyRole = role.slug;
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const employee = repo.create({
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      password_hash: passwordHash,
      phone: data.phone?.trim() || null,
      pin_hash: pinHash,
      role: legacyRole,
      role_id: data.role_id || null,
      branch_id: data.branch_id || null,
      is_active: true,
      is_owner: false,
    });

    const saved = await repo.save(employee);

    // Sync branch-role assignments
    if (data.branch_assignments && Array.isArray(data.branch_assignments)) {
      await this.syncBranchRoles(connection, saved.id, data.branch_assignments);
    }

    // Permission overrides
    if (data.permission_overrides && Array.isArray(data.permission_overrides)) {
      await this.syncPermissionOverrides(connection, saved.id, data.permission_overrides);
    }

    return this.findOne(connection, saved.id);
  }

  async update(connection: DataSource, id: string, data: any, requesterId?: string) {
    const repo = connection.getRepository(Employee);
    const employee = await repo.findOne({ where: { id } });
    if (!employee) throw new NotFoundException('Empleado no encontrado');

    // Owner protection
    if (employee.is_owner && requesterId !== employee.id) {
      if (data.is_active === false || data.role_id || data.branch_assignments) {
        throw new ForbiddenException('No se puede modificar al propietario del tenant');
      }
    }

    // Self-edit protection (can't change own role unless has security.manage_roles)
    if (requesterId === id && (data.role_id || data.branch_assignments)) {
      throw new ForbiddenException('No puedes cambiar tu propio rol');
    }

    // Email uniqueness
    if (data.email && data.email.toLowerCase() !== employee.email) {
      const dup = await repo.findOne({ where: { email: data.email.toLowerCase() } });
      if (dup) throw new ConflictException('Este correo electrónico ya está en uso');
      employee.email = data.email.toLowerCase();
    }

    if (data.name) employee.name = data.name.trim();
    if (data.phone !== undefined) employee.phone = data.phone?.trim() || null;
    if (data.branch_id !== undefined) employee.branch_id = data.branch_id || null;

    // Password update
    if (data.password) {
      if (data.password.length < 8) throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
      employee.password_hash = await bcrypt.hash(data.password, 12);
    }

    // PIN update
    if (data.pin !== undefined) {
      if (data.pin === '' || data.pin === null) {
        employee.pin_hash = null;
      } else {
        if (!/^\d{4,6}$/.test(data.pin))
          throw new BadRequestException('El PIN debe ser de 4 a 6 dígitos numéricos');
        await this.validatePinUniqueness(connection, data.pin, id);
        employee.pin_hash = await bcrypt.hash(data.pin, 10);
      }
    }

    // Role update → sync legacy column
    if (data.role_id) {
      const roleRepo = connection.getRepository(Role);
      const role = await roleRepo.findOne({ where: { id: data.role_id } });
      if (role) {
        employee.role_id = data.role_id;
        employee.role = role.slug;
      }
    }

    await repo.save(employee);

    // Branch-role assignments
    if (data.branch_assignments !== undefined) {
      await this.syncBranchRoles(connection, id, data.branch_assignments || []);
    }

    // Permission overrides
    if (data.permission_overrides !== undefined) {
      await this.syncPermissionOverrides(connection, id, data.permission_overrides || []);
    }

    return this.findOne(connection, id);
  }

  async toggleStatus(connection: DataSource, id: string) {
    const repo = connection.getRepository(Employee);
    const employee = await repo.findOne({ where: { id } });
    if (!employee) throw new NotFoundException('Empleado no encontrado');
    if (employee.is_owner) throw new ForbiddenException('No se puede desactivar al propietario');

    employee.is_active = !employee.is_active;
    await repo.save(employee);
    const { password_hash, pin_hash, ...result } = employee;
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PIN UNIQUENESS VALIDATION
  // ═══════════════════════════════════════════════════════════════════

  private async validatePinUniqueness(connection: DataSource, pin: string, excludeEmployeeId: string | null) {
    const employees = await connection.getRepository(Employee)
      .createQueryBuilder('e')
      .where('e.pin_hash IS NOT NULL')
      .andWhere('e.is_active = true')
      .getMany();

    for (const emp of employees) {
      if (excludeEmployeeId && emp.id === excludeEmployeeId) continue;
      const match = await bcrypt.compare(pin, emp.pin_hash!);
      if (match) throw new ConflictException('Este PIN ya está en uso por otro empleado');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  BRANCH-ROLE SYNC
  // ═══════════════════════════════════════════════════════════════════

  private async syncBranchRoles(
    connection: DataSource,
    employeeId: string,
    assignments: { branch_id: string; role_id: string }[],
  ) {
    const repo = connection.getRepository(BranchRoleEmployee);
    await repo.delete({ employee_id: employeeId });

    if (assignments.length > 0) {
      const entities = assignments.map((a) =>
        repo.create({
          employee_id: employeeId,
          branch_id: a.branch_id,
          role_id: a.role_id,
        }),
      );
      await repo.save(entities);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PERMISSION OVERRIDES SYNC
  // ═══════════════════════════════════════════════════════════════════

  private async syncPermissionOverrides(
    connection: DataSource,
    employeeId: string,
    overrides: { permission_id: string; granted: boolean }[],
  ) {
    const epRepo = connection.getRepository(EmployeePermission);
    await epRepo.delete({ employee_id: employeeId });
    if (overrides.length > 0) {
      const entities = overrides.map((o) =>
        epRepo.create({
          employee_id: employeeId,
          permission_id: o.permission_id,
          granted: o.granted,
        }),
      );
      await epRepo.save(entities);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ROLES — CRUD + Permission Matrix
  // ═══════════════════════════════════════════════════════════════════

  async getRoles(connection: DataSource) {
    return connection.getRepository(Role).find({ order: { created_at: 'ASC' } });
  }

  async createRole(connection: DataSource, data: { name: string; slug: string; description?: string }) {
    const repo = connection.getRepository(Role);
    const existing = await repo.findOne({ where: { slug: data.slug } });
    if (existing) throw new ConflictException('Ya existe un rol con este identificador');

    const role = repo.create({
      name: data.name.trim(),
      slug: data.slug.trim().toLowerCase(),
      description: data.description?.trim() || null,
      is_system: false,
    });
    return repo.save(role);
  }

  async updateRole(connection: DataSource, roleId: string, data: { name?: string; description?: string }) {
    const repo = connection.getRepository(Role);
    const role = await repo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Rol no encontrado');

    if (data.name) role.name = data.name.trim();
    if (data.description !== undefined) role.description = data.description?.trim() || null;
    return repo.save(role);
  }

  async deleteRole(connection: DataSource, roleId: string) {
    const repo = connection.getRepository(Role);
    const role = await repo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Rol no encontrado');
    if (role.is_system) throw new ForbiddenException('No se puede eliminar un rol del sistema');

    // Check no employees assigned
    const count = await connection.getRepository(Employee).count({ where: { role_id: roleId } });
    const breCount = await connection.getRepository(BranchRoleEmployee).count({ where: { role_id: roleId } });
    if (count > 0 || breCount > 0) {
      throw new BadRequestException('No se puede eliminar un rol con empleados asignados');
    }

    await connection.getRepository(RolePermission).delete({ role_id: roleId });
    await repo.remove(role);
    return { deleted: true };
  }

  // ─── Role Permission Matrix ────────────────────────────────────

  async getRolePermissions(connection: DataSource, roleId: string) {
    const rps = await connection.getRepository(RolePermission).find({
      where: { role_id: roleId },
      relations: ['permission'],
    });
    return rps.map((rp) => (rp as any).permission.key);
  }

  async setRolePermissions(connection: DataSource, roleId: string, permissionKeys: string[]) {
    const role = await connection.getRepository(Role).findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Rol no encontrado');

    const rpRepo = connection.getRepository(RolePermission);
    const permRepo = connection.getRepository(Permission);

    // Delete all current
    await rpRepo.delete({ role_id: roleId });

    // Insert new
    if (permissionKeys.length > 0) {
      const permissions = await permRepo.find({ where: { key: In(permissionKeys) } });
      const entities = permissions.map((p) =>
        rpRepo.create({ role_id: roleId, permission_id: p.id }),
      );
      await rpRepo.save(entities);
    }

    return this.getRolePermissions(connection, roleId);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PERMISSIONS — Catalog
  // ═══════════════════════════════════════════════════════════════════

  async getPermissions(connection: DataSource) {
    await this.seedPermissions(connection);
    const permRepo = connection.getRepository(Permission);
    const permissions = await permRepo.find({ order: { module: 'ASC', sort_order: 'ASC' } });

    const grouped: Record<string, { key: string; id: string; name: string; submodule: string | null }[]> = {};
    for (const p of permissions) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push({ key: p.key, id: p.id, name: p.name, submodule: p.submodule });
    }
    return { permissions, grouped };
  }

  async getEmployeePermissions(connection: DataSource, employeeId: string) {
    const epRepo = connection.getRepository(EmployeePermission);
    const eps = await epRepo.find({
      where: { employee_id: employeeId },
      relations: ['permission'],
    });
    return eps.map((ep) => ({
      permission_key: (ep as any).permission.key,
      permission_id: ep.permission_id,
      granted: ep.granted,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  RESOLVE EFFECTIVE PERMISSIONS — for a user in a branch context
  // ═══════════════════════════════════════════════════════════════════

  async resolvePermissions(connection: DataSource, employeeId: string, branchId?: string): Promise<string[]> {
    const employee = await connection.getRepository(Employee).findOne({
      where: { id: employeeId },
      relations: ['branch_roles'],
    });
    if (!employee) return [];

    // Owner has all permissions
    if (employee.is_owner) {
      const allPerms = await connection.getRepository(Permission).find();
      return allPerms.map((p) => p.key);
    }

    // Determine role: branch-specific role if available, else default role
    let roleId = employee.role_id;
    if (branchId && employee.branch_roles) {
      const branchRole = employee.branch_roles.find((br) => br.branch_id === branchId);
      if (branchRole) roleId = branchRole.role_id;
    }

    if (!roleId) return [];

    // Get role permissions
    const rolePerms = await connection.getRepository(RolePermission).find({
      where: { role_id: roleId },
      relations: ['permission'],
    });
    const permSet = new Set(rolePerms.map((rp) => (rp as any).permission.key));

    // Apply employee overrides
    const overrides = await connection.getRepository(EmployeePermission).find({
      where: { employee_id: employeeId },
      relations: ['permission'],
    });
    for (const override of overrides) {
      const key = (override as any).permission.key;
      if (override.granted) {
        permSet.add(key);
      } else {
        permSet.delete(key);
      }
    }

    return Array.from(permSet);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MANAGER OVERRIDE — PIN authorization for restricted actions
  // ═══════════════════════════════════════════════════════════════════

  async managerOverride(
    connection: DataSource,
    data: { pin: string; required_permission: string; branch_id: string; action_description?: string },
  ) {
    // Find employee by PIN in this branch
    const employees = await connection.getRepository(Employee)
      .createQueryBuilder('e')
      .where('e.is_active = true')
      .andWhere('e.pin_hash IS NOT NULL')
      .getMany();

    let authorizer: Employee | null = null;
    for (const emp of employees) {
      const isMatch = await bcrypt.compare(data.pin, emp.pin_hash!);
      if (isMatch) { authorizer = emp; break; }
    }

    if (!authorizer) throw new ForbiddenException('PIN inválido');

    // Check authorizer has the required permission in this branch
    const permissions = await this.resolvePermissions(connection, authorizer.id, data.branch_id);

    if (!permissions.includes(data.required_permission) && !permissions.includes('security.manager_override')) {
      throw new ForbiddenException('El empleado no tiene permiso para autorizar esta acción');
    }

    return {
      authorized: true,
      authorizer_id: authorizer.id,
      authorizer_name: authorizer.name,
      permission: data.required_permission,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CHECK PERMISSION — for guards and middleware
  // ═══════════════════════════════════════════════════════════════════

  async hasPermission(connection: DataSource, employeeId: string, permission: string, branchId?: string): Promise<boolean> {
    const permissions = await this.resolvePermissions(connection, employeeId, branchId);
    return permissions.includes(permission);
  }
}
