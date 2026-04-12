import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { SuperAdmin, Tenant } from '@nivo/database';
import { TenantConnectionManager } from '../database/tenant-connection.manager';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  type: 'super-admin' | 'employee';
  tenant_id?: string;
  role_id?: string;
  is_owner?: boolean;
  branch_id?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(SuperAdmin)
    private readonly superAdminRepo: Repository<SuperAdmin>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly jwtService: JwtService,
    private readonly tenantConnectionManager: TenantConnectionManager,
  ) {}

  async loginSuperAdmin(email: string, password: string) {
    const admin = await this.superAdminRepo.findOne({ where: { email } });
    if (!admin) throw new UnauthorizedException('Invalid credentials');

    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    const payload: JwtPayload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      type: 'super-admin',
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: { id: admin.id, email: admin.email, role: admin.role },
    };
  }

  async loginEmployee(email: string, password: string, tenantSubdomain: string) {
    const tenant = await this.tenantRepo.findOne({
      where: { subdomain: tenantSubdomain, is_active: true },
    });
    if (!tenant) throw new UnauthorizedException('Tenant not found');

    const connection = await this.tenantConnectionManager.getConnection(tenant.database_name);
    const employeeRepo = connection.getRepository('Employee');
    const employee = await employeeRepo.findOne({ where: { email, is_active: true } });
    if (!employee) throw new UnauthorizedException('Invalid credentials');

    const isValid = await bcrypt.compare(password, (employee as any).password_hash);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    const payload: JwtPayload = {
      sub: (employee as any).id,
      email: (employee as any).email,
      role: (employee as any).role,
      type: 'employee',
      tenant_id: tenant.id,
      role_id: (employee as any).role_id || undefined,
      is_owner: (employee as any).is_owner || false,
      branch_id: (employee as any).branch_id || undefined,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: (employee as any).id,
        email: (employee as any).email,
        name: (employee as any).name,
        role: (employee as any).role,
        role_id: (employee as any).role_id,
        is_owner: (employee as any).is_owner || false,
        branch_id: (employee as any).branch_id,
      },
      tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
    };
  }

  async loginByPin(pinCode: string, tenantSubdomain: string, branchId: string) {
    const tenant = await this.tenantRepo.findOne({
      where: { subdomain: tenantSubdomain, is_active: true },
    });
    if (!tenant) throw new UnauthorizedException('Tenant not found');

    const connection = await this.tenantConnectionManager.getConnection(tenant.database_name);
    const employeeRepo = connection.getRepository('Employee');

    // Load all active employees in this branch that have a PIN configured
    const employees = await employeeRepo
      .createQueryBuilder('e')
      .where('e.branch_id = :branchId', { branchId })
      .andWhere('e.is_active = true')
      .andWhere('e.pin_hash IS NOT NULL')
      .getMany();

    // Compare PIN against each employee's hash (bcrypt)
    let matched: any = null;
    for (const emp of employees) {
      const isMatch = await bcrypt.compare(pinCode, (emp as any).pin_hash);
      if (isMatch) {
        matched = emp;
        break;
      }
    }
    if (!matched) throw new UnauthorizedException('PIN invalido');

    const payload: JwtPayload = {
      sub: matched.id,
      email: matched.email,
      role: matched.role,
      type: 'employee',
      tenant_id: tenant.id,
      role_id: matched.role_id || undefined,
      is_owner: matched.is_owner || false,
      branch_id: matched.branch_id || undefined,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: matched.id,
        name: matched.name,
        role: matched.role,
        role_id: matched.role_id,
        is_owner: matched.is_owner || false,
        branch_id: matched.branch_id,
      },
      tenant: { id: tenant.id, name: tenant.name },
    };
  }

  async changePassword(adminId: string, currentPassword: string, newPassword: string) {
    const admin = await this.superAdminRepo.findOne({ where: { id: adminId } });
    if (!admin) throw new UnauthorizedException('Admin not found');

    const isValid = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!isValid) throw new UnauthorizedException('Contraseña actual incorrecta');

    admin.password_hash = await bcrypt.hash(newPassword, 10);
    await this.superAdminRepo.save(admin);

    return { message: 'Contraseña actualizada correctamente' };
  }

  async impersonate(superAdminId: string, tenantId: string) {
    const admin = await this.superAdminRepo.findOne({ where: { id: superAdminId } });
    if (!admin || admin.role !== 'super-admin') {
      throw new UnauthorizedException('Only super admins can impersonate');
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new UnauthorizedException('Tenant not found');

    const payload: JwtPayload = {
      sub: admin.id,
      email: admin.email,
      role: 'admin',
      type: 'employee',
      tenant_id: tenant.id,
    };

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '2h' }),
      tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
      impersonated: true,
    };
  }
}
