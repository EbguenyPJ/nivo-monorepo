import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import {
  Employee, Permission, RolePermission, EmployeePermission, BranchRoleEmployee,
} from '@nivo/database';

/**
 * Guard that checks RBAC permissions using the tenant connection.
 *
 * Resolution order:
 * 1. Owner → all permissions granted
 * 2. Branch-specific role (if branch_id present in query/body/header)
 * 3. Default role (employee.role_id)
 * 4. Employee-level overrides (grant/revoke)
 *
 * If no @Permissions() decorator is present, the guard passes (no restriction).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Permissions decorator → allow
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const connection = request.tenantConnection;

    if (!user || !connection) return false;

    const employeeId = user.sub;

    // Load employee
    const employee = await connection.getRepository(Employee).findOne({
      where: { id: employeeId },
      relations: ['branch_roles'],
    });

    if (!employee) return false;

    // Owner has ALL permissions
    if (employee.is_owner) return true;

    // Determine branch context
    const branchId =
      request.query?.branch_id ||
      request.body?.branch_id ||
      request.headers['x-branch-id'] ||
      employee.branch_id;

    // Determine role: branch-specific or default
    let roleId = employee.role_id;
    if (branchId && employee.branch_roles) {
      const branchRole = employee.branch_roles.find(
        (br: BranchRoleEmployee) => br.branch_id === branchId,
      );
      if (branchRole) roleId = branchRole.role_id;
    }

    // Build permission set from role
    const permSet = new Set<string>();

    if (roleId) {
      const rolePerms = await connection.getRepository(RolePermission).find({
        where: { role_id: roleId },
        relations: ['permission'],
      });
      for (const rp of rolePerms) {
        permSet.add((rp as any).permission.key);
      }
    }

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

    // Check: user needs ANY of the required permissions (OR)
    const hasAny = requiredPermissions.some((p) => permSet.has(p));
    if (!hasAny) {
      throw new ForbiddenException('No tienes permiso para realizar esta acción');
    }

    return true;
  }
}
