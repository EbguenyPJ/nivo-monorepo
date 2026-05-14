import pg from 'pg';
import { DB_CONFIG } from '../config/constants.js';

const { Pool } = pg;

const pools = new Map<string, pg.Pool>();

export function getMasterPool(): pg.Pool {
  return getPool(DB_CONFIG.masterDb);
}

export function getTenantPool(dbName: string): pg.Pool {
  return getPool(dbName);
}

function getPool(database: string): pg.Pool {
  if (!pools.has(database)) {
    pools.set(
      database,
      new Pool({
        host: DB_CONFIG.host,
        port: DB_CONFIG.port,
        user: DB_CONFIG.user,
        password: DB_CONFIG.password,
        database,
        max: 5,
      })
    );
  }
  return pools.get(database)!;
}

export async function closeAll(): Promise<void> {
  for (const [name, pool] of pools) {
    await pool.end();
    console.log(`  Pool closed: ${name}`);
  }
  pools.clear();
}

export async function createTenantDatabase(dbName: string): Promise<void> {
  const master = getMasterPool();

  // Drop existing tenant pool connection if cached
  if (pools.has(dbName)) {
    await pools.get(dbName)!.end();
    pools.delete(dbName);
  }

  const exists = await master.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [dbName]
  );

  if (exists.rows.length > 0) {
    // Terminate active connections and drop for a clean re-run
    await master.query(`
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [dbName]);
    await master.query(`DROP DATABASE "${dbName}"`);
    console.log(`  Database dropped (re-run): ${dbName}`);
  }

  await master.query(`CREATE DATABASE "${dbName}" OWNER "${DB_CONFIG.user}"`);
  console.log(`  Database created: ${dbName}`);
}

export async function query(pool: pg.Pool, sql: string, params: any[] = []): Promise<pg.QueryResult> {
  return pool.query(sql, params);
}

export async function insert(
  pool: pg.Pool,
  table: string,
  data: Record<string, any>
): Promise<string> {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const columns = keys.map(k => `"${k}"`).join(', ');

  const result = await pool.query(
    `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) RETURNING id`,
    values
  );
  return result.rows[0].id;
}

export async function insertMany(
  pool: pg.Pool,
  table: string,
  rows: Record<string, any>[]
): Promise<string[]> {
  if (rows.length === 0) return [];

  const keys = Object.keys(rows[0]);
  const columns = keys.map(k => `"${k}"`).join(', ');
  const ids: string[] = [];

  // Batch in chunks of 100 to avoid parameter limits
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const allValues: any[] = [];
    const rowPlaceholders: string[] = [];

    for (let r = 0; r < chunk.length; r++) {
      const offset = r * keys.length;
      const ph = keys.map((_, k) => `$${offset + k + 1}`).join(', ');
      rowPlaceholders.push(`(${ph})`);
      for (const key of keys) {
        allValues.push(chunk[r][key]);
      }
    }

    const result = await pool.query(
      `INSERT INTO "${table}" (${columns}) VALUES ${rowPlaceholders.join(', ')} RETURNING id`,
      allValues
    );
    ids.push(...result.rows.map((r: any) => r.id));
  }

  return ids;
}

export async function upsert(
  pool: pg.Pool,
  table: string,
  data: Record<string, any>,
  conflictColumns: string[]
): Promise<string> {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const columns = keys.map(k => `"${k}"`).join(', ');
  const conflict = conflictColumns.map(c => `"${c}"`).join(', ');
  const updates = keys
    .filter(k => !conflictColumns.includes(k))
    .map(k => `"${k}" = EXCLUDED."${k}"`)
    .join(', ');

  const result = await pool.query(
    `INSERT INTO "${table}" (${columns}) VALUES (${placeholders})
     ON CONFLICT (${conflict}) DO UPDATE SET ${updates}
     RETURNING id`,
    values
  );
  return result.rows[0].id;
}
