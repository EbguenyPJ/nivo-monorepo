import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator that marks a route as requiring specific permissions.
 * Usage: @Permissions('pos.sell', 'pos.apply_discount')
 * The user needs ANY of the listed permissions (OR logic).
 */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
