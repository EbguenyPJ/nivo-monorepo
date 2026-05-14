import pg from 'pg';
import bcrypt from 'bcryptjs';
import { query } from '../../db/connection.js';
import { CREDENTIALS } from '../../config/credentials.js';

export async function seedSuperAdmin(pool: pg.Pool): Promise<string> {
  const hash = bcrypt.hashSync(CREDENTIALS.superAdmin.password, 12);
  const result = await query(pool,
    `INSERT INTO "super_admins" ("email", "password_hash", "role")
     VALUES ($1, $2, $3)
     ON CONFLICT ("email") DO UPDATE SET "password_hash" = EXCLUDED."password_hash"
     RETURNING id`,
    [CREDENTIALS.superAdmin.email, hash, CREDENTIALS.superAdmin.role]
  );
  return result.rows[0].id;
}
