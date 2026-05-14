import pg from 'pg';
import { insert } from '../../db/connection.js';

export async function createNotification(
  pool: pg.Pool,
  type: string,
  title: string,
  message: string,
  tenantId?: string,
  tenantName?: string,
  createdAt?: Date
): Promise<void> {
  await insert(pool, 'notifications', {
    type,
    title,
    message,
    tenant_id: tenantId || null,
    tenant_name: tenantName || null,
    is_read: Math.random() > 0.3,
    created_at: (createdAt || new Date()).toISOString(),
  });
}
