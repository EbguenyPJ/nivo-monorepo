/**
 * Downloads demo assets: shoe images, logos, receipt photos.
 * Uses placeholder services (no API key required).
 *
 * Usage: pnpm download-assets
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const BASE_DIR = join(process.cwd(), '..', '..', 'nivo-demo-assets', 'uploads');

const DIRS = ['products', 'logos', 'receipts', 'delivery', 'brands'];

async function downloadFile(url: string, dest: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, buffer);
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  console.log('Downloading demo assets...\n');

  // Create directories
  for (const dir of DIRS) {
    const path = join(BASE_DIR, dir);
    mkdirSync(path, { recursive: true });
    console.log(`  Created: ${path}`);
  }

  // Shoe images (50) — using picsum.photos as placeholder
  console.log('\n  Downloading 50 shoe product images...');
  for (let i = 1; i <= 50; i++) {
    const dest = join(BASE_DIR, 'products', `shoe-${i}.jpg`);
    if (existsSync(dest)) { process.stdout.write('.'); continue; }
    // Use consistent seeds for reproducibility
    const url = `https://picsum.photos/seed/shoe${i}/400/400`;
    const ok = await downloadFile(url, dest);
    process.stdout.write(ok ? '.' : 'x');
  }
  console.log(' Done');

  // Logos (10)
  console.log('  Downloading 10 company logos...');
  const logoNames = ['3hermanos', 'labota', 'shoepalace', 'pisafirme', 'elpaso', 'flexioutlet', 'donjulio', 'urbankicks', 'mundoinfantil', 'eleganza'];
  for (let i = 0; i < logoNames.length; i++) {
    const dest = join(BASE_DIR, 'logos', `${logoNames[i]}-logo.png`);
    if (existsSync(dest)) { process.stdout.write('.'); continue; }
    const url = `https://picsum.photos/seed/logo${i}/200/200`;
    const ok = await downloadFile(url, dest);
    process.stdout.write(ok ? '.' : 'x');
  }
  console.log(' Done');

  // Brand logos
  console.log('  Downloading brand logos...');
  const brandNames = ['nike', 'adidas', 'flexi', 'andrea', 'caterpillar', 'skechers', 'converse', 'vans', 'puma', 'new-balance'];
  for (let i = 0; i < brandNames.length; i++) {
    const dest = join(BASE_DIR, 'brands', `${brandNames[i]}.png`);
    if (existsSync(dest)) { process.stdout.write('.'); continue; }
    const url = `https://picsum.photos/seed/brand${i}/150/150`;
    const ok = await downloadFile(url, dest);
    process.stdout.write(ok ? '.' : 'x');
  }
  console.log(' Done');

  // Receipt photos (20)
  console.log('  Downloading 20 receipt/expense photos...');
  for (let i = 1; i <= 20; i++) {
    const dest = join(BASE_DIR, 'receipts', `expense-${i}.jpg`);
    if (existsSync(dest)) { process.stdout.write('.'); continue; }
    const url = `https://picsum.photos/seed/receipt${i}/300/400`;
    const ok = await downloadFile(url, dest);
    process.stdout.write(ok ? '.' : 'x');
  }
  console.log(' Done');

  console.log('\n✅ All assets downloaded to nivo-demo-assets/uploads/');
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
