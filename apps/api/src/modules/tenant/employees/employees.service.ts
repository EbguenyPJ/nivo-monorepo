import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Employee, Role, Permission, RolePermission, EmployeePermission } from '@nivo/database';

@Injectable()
export class EmployeesService {
  // ─── LIST ──────────────────────────────────────────────────────
  async findAll(connection: DataSource, branchId?: string) {
    const repo = connection.getRepository(Employee);
    const where: any = {};
    if (branchId) where.branch_id = branchId;

    const employees = await repo.find({
      where,
      relations: ['branch', 'roleEntity'],
      order: { created_at: 'ASC' },
    });
    return employees.map(({ password_hash, pin_hash, ...emp }) => emp);
  }

  // ─── GET ONE ───────────────────────────────────────────────────
  async findOne(connection: DataSource, id: string) {
    const repo = connection.getRepository(Employee);
    const employee = await repo.findOne({
      where: { id },
      relations: ['branch', 'roleEntity'],
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado');
    const { password_hash, pin_hash, ...result } = employee;
    return result;
  }

  // ─── CREATE ────────────────────────────────────────────────────
  async create(connection: DataSource, data: any) {
    const repo = connection.getRepository(Employee);

    if (!data.name?.trim()) throw new BadRequestException('El nombre es obligatorio');
    if (!data.email?.trim()) throw new BadRequestException('El correo es obligatorio');
    if (!data.password || data.password.length < 8)
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
    if (!data.branch_id) throw new BadRequestException('La sucursal es obligatoria');
    if (!data.role_id) throw new BadRequestException('El rol es obligatorio');

    const existing = await repo.findOne({ where: { email: data.email } });
    if (existing) throw new ConflictException('Este correo electrónico ya está en uso');

    // Validate PIN uniqueness within tenant if provided
    let pinHash: string | null = null;
    if (data.pin) {
      if (!/^\d{4,6}$/.test(data.pin))
        throw new BadRequestException('El PIN debe ser de 4 a 6 dígitos numéricos');
      pinHash = await bcrypt.hash(data.pin, 10);
    }

    // Resolve role slug for legacy column
    const roleRepo = connection.getRepository(Role);
    const role = await roleRepo.findOne({ where: { id: data.role_id } });
    if (!role) throw new BadRequestException('Rol no encontrado');

    const passwordHash = await bcrypt.hash(data.password, 12);
    const employee = repo.create({
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      password_hash: passwordHash,
      phone: data.phone?.trim() || null,
      pin_hash: pinHash,
      role: role.slug, // legacy column
      role_id: data.role_id,
      branch_id: data.branch_id,
      is_active: true,
    });

    const saved = await repo.save(employee);

    // Save permission overrides if any
    if (data.permission_overrides && Array.isArray(data.permission_overrides)) {
      await this.syncPermissionOverrides(connection, saved.id, data.permission_overrides);
    }

    const { password_hash, pin_hash: _, ...result } = saved;
    return result;
  }

  // ─── UPDATE ────────────────────────────────────────────────────
  async update(connection: DataSource, id: string, data: any) {
    const repo = connection.getRepository(Employee);
    const employee = await repo.findOne({ where: { id } });
    if (!employee) throw new NotFoundException('Empleado no encontrado');

    // Email uniqueness check
    if (data.email && data.email.toLowerCase() !== employee.email) {
      const dup = await repo.findOne({ where: { email: data.email.toLowerCase() } });
      if (dup) throw new ConflictException('Este correo electrónico ya está en uso');
      data.email = data.email.toLowerCase();
    }

    // Password update
    if (data.password) {
      if (data.password.length < 8) throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
      data.password_hash = await bcrypt.hash(data.password, 12);
      delete data.password;
    }

    // PIN update
    if (data.pin !== undefined) {
      if (data.pin === '' || data.pin === null) {
        data.pin_hash = null;
      } else {
        if (!/^\d{4,6}$/.test(data.pin))
          throw new BadRequestException('El PIN debe ser de 4 a 6 dígitos numéricos');
        data.pin_hash = await bcrypt.hash(data.pin, 10);
      }
      delete data.pin;
    }

    // Role update → also sync legacy column
    if (data.role_id) {
      const roleRepo = connection.getRepository(Role);
      const role = await roleRepo.findOne({ where: { id: data.role_id } });
      if (role) data.role = role.slug;
    }

    // Permission overrides
    if (data.permission_overrides !== undefined) {
      await this.syncPermissionOverrides(connection, id, data.permission_overrides || []);
      delete data.permission_overrides;
    }

    // Clean up fields that shouldn't be set directly
    delete data.pin;

    Object.assign(employee, data);
    const saved = await repo.save(employee);
    const { password_hash, pin_hash, ...result } = saved;
    return result;
  }

  // ─── TOGGLE STATUS ─────────────────────────────────────────────
  async toggleStatus(connection: DataSource, id: string) {
    const repo = connection.getRepository(Employee);
    const employee = await repo.findOne({ where: { id } });
    if (!employee) throw new NotFoundException('Empleado no encontrado');

    employee.is_active = !employee.is_active;
    const saved = await repo.save(employee);
    const { password_hash, pin_hash, ...result } = saved;
    return result;
  }

  // ─── GET ROLES ─────────────────────────────────────────────────
  async getRoles(connection: DataSource) {
    const roleRepo = connection.getRepository(Role);
    return roleRepo.find({ order: { created_at: 'ASC' } });
  }

  // ─── GET ALL PERMISSIONS (grouped for UI) ──────────────────────
  async getPermissions(connection: DataSource) {
    const permRepo = connection.getRepository(Permission);
    const permissions = await permRepo.find({ order: { module: 'ASC', sort_order: 'ASC' } });

    // Group by module for the UI tree
    const grouped: Record<string, { key: string; id: string; name: string; submodule: string | null }[]> = {};
    for (const p of permissions) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push({ key: p.key, id: p.id, name: p.name, submodule: p.submodule });
    }
    return { permissions, grouped };
  }

  // ─── GET ROLE PERMISSIONS (for a specific role) ────────────────
  async getRolePermissions(connection: DataSource, roleId: string) {
    const rpRepo = connection.getRepository(RolePermission);
    const rps = await rpRepo.find({
      where: { role_id: roleId },
      relations: ['permission'],
    });
    return rps.map((rp) => (rp as any).permission.key);
  }

  // ─── GET EMPLOYEE PERMISSION OVERRIDES ─────────────────────────
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

  // ─── SYNC PERMISSION OVERRIDES ─────────────────────────────────
  private async syncPermissionOverrides(
    connection: DataSource,
    employeeId: string,
    overrides: { permission_id: string; granted: boolean }[],
  ) {
    const epRepo = connection.getRepository(EmployeePermission);
    // Remove all existing overrides
    await epRepo.delete({ employee_id: employeeId });
    // Insert new ones
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
}
