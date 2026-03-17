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
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: (employee as any).id,
        email: (employee as any).email,
        name: (employee as any).name,
        role: (employee as any).role,
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
    const employee = await employeeRepo.findOne({
      where: { pin_code: pinCode, branch_id: branchId, is_active: true },
    });
    if (!employee) throw new UnauthorizedException('Invalid PIN');

    const payload: JwtPayload = {
      sub: (employee as any).id,
      email: (employee as any).email,
      role: (employee as any).role,
      type: 'employee',
      tenant_id: tenant.id,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: (employee as any).id,
        name: (employee as any).name,
        role: (employee as any).role,
      },
      tenant: { id: tenant.id, name: tenant.name },
    };
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
