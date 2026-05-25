import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request, Response, NextFunction } from 'express';
import { Tenant } from '@nivo/database';
import { TenantConnectionManager } from './tenant-connection.manager';

declare global {
  namespace Express {
    interface Request {
      tenantConnection?: import('typeorm').DataSource;
      tenant?: Tenant;
    }
  }
}

@Injectable()
export class TenantConnectionMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly connectionManager: TenantConnectionManager,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const subdomain = this.extractSubdomain(req);
    if (!subdomain) {
      return next();
    }

    const tenant = await this.tenantRepo.findOne({
      where: { subdomain, is_active: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant "${subdomain}" not found or inactive`);
    }

    req.tenant = tenant;
    req.tenantConnection = await this.connectionManager.getConnection(tenant.database_name);
    next();
  }

  private extractSubdomain(req: Request): string | null {
    const tenantHeader = req.headers['x-tenant-id'] as string;
    if (tenantHeader) return tenantHeader;

    const host = req.hostname;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
    const parts = host.split('.');
    if (parts.length >= 3) {
      return parts[0];
    }

    return null;
  }
}
