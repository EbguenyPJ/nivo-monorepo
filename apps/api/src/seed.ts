import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { SuperAdmin, Tenant, Subscription } from '@nivo/database';

const SUPER_ADMIN_EMAIL = 'admin@nivo.com';
const SUPER_ADMIN_PASSWORD = 'Admin123!';

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.MASTER_DB_HOST || 'localhost',
    port: parseInt(process.env.MASTER_DB_PORT || '5433', 10),
    username: process.env.MASTER_DB_USERNAME || 'nivo_admin',
    password: process.env.MASTER_DB_PASSWORD || 'nivo_secret_2024',
    database: process.env.MASTER_DB_NAME || 'nivo_master_db',
    entities: [SuperAdmin, Tenant, Subscription],
    synchronize: true,
  });

  await dataSource.initialize();
  console.log('Connected to master database.');

  const repo = dataSource.getRepository(SuperAdmin);

  const existing = await repo.findOne({ where: { email: SUPER_ADMIN_EMAIL } });
  if (existing) {
    console.log(`Super admin "${SUPER_ADMIN_EMAIL}" already exists. Skipping.`);
    await dataSource.destroy();
    return;
  }

  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
  const admin = repo.create({
    email: SUPER_ADMIN_EMAIL,
    password_hash: passwordHash,
    role: 'super-admin',
  });

  await repo.save(admin);
  console.log('');
  console.log('=== Super Admin Created ===');
  console.log(`  Email:    ${SUPER_ADMIN_EMAIL}`);
  console.log(`  Password: ${SUPER_ADMIN_PASSWORD}`);
  console.log(`  Role:     super-admin`);
  console.log('');
  console.log('Use POST /auth/login with these credentials to get a JWT token.');
  console.log('Then use POST /tenants to create your first tenant (business).');
  console.log('===========================');

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
