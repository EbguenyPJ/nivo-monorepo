// Seeded PRNG for reproducibility (xoshiro128**)
let s0 = 123456789;
let s1 = 362436069;
let s2 = 521288629;
let s3 = 88675123;

export function seedRng(seed: number): void {
  s0 = seed;
  s1 = seed ^ 0x12345678;
  s2 = seed ^ 0x87654321;
  s3 = seed ^ 0xdeadbeef;
  for (let i = 0; i < 20; i++) random();
}

export function random(): number {
  const t = s1 << 9;
  let r = s1 * 5;
  r = ((r << 7) | (r >>> 25)) * 9;
  s2 ^= s0;
  s3 ^= s1;
  s1 ^= s2;
  s0 ^= s3;
  s2 ^= t;
  s3 = (s3 << 11) | (s3 >>> 21);
  return (r >>> 0) / 4294967296;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number, decimals = 2): number {
  const val = random() * (max - min) + min;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(random() * arr.length)];
}

export function pickN<T>(arr: readonly T[], n: number): T[] {
  const shuffled = [...arr].sort(() => random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

export function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function chance(probability: number): boolean {
  return random() < probability;
}

export function gaussian(mean: number, stdDev: number): number {
  const u1 = random();
  const u2 = random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function poissonSample(lambda: number): number {
  let L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= random();
  } while (p > L);
  return k - 1;
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randomPhone(): string {
  const area = pick(['222', '221', '223', '55', '33', '81', '442', '241', '271']);
  const num = String(randomInt(1000000, 9999999));
  return `+52${area}${num}`;
}

export function randomEmail(name: string, domain?: string): string {
  const clean = name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z.]/g, '');
  const suffix = randomInt(1, 999);
  return `${clean}${suffix}@${domain || pick(['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.mx'])}`;
}

export function randomRfc(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const l = () => letters[randomInt(0, 25)];
  const d = () => String(randomInt(0, 9));
  return `${l()}${l()}${l()}${l()}${d()}${d()}${d()}${d()}${d()}${d()}${l()}${d()}${l()}`.substring(0, 13);
}
