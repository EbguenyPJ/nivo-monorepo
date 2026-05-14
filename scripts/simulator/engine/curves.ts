/**
 * Sales volume curves: day-of-week, payday, seasonal, and growth modifiers.
 */

// Day-of-week multiplier (0=Sun, 6=Sat)
const DOW_MULTIPLIERS = [1.35, 0.75, 0.60, 0.80, 0.85, 0.95, 1.50];

export function dayOfWeekMultiplier(date: Date): number {
  return DOW_MULTIPLIERS[date.getDay()];
}

// Payday spikes: 15th and last day of month (+40-60%), surrounding days get smaller boost
export function paydayMultiplier(date: Date): number {
  const day = date.getDate();
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

  if (day === 15 || day === lastDay) return 1.55;
  if (day === 14 || day === 16 || day === lastDay - 1) return 1.25;
  if (day === 1) return 1.30; // post-payday shopping
  return 1.0;
}

// Seasonal: back-to-school (Aug), Buen Fin (Nov mid), Christmas (Dec), Valentine's (Feb 14)
export function seasonalMultiplier(date: Date): number {
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  // Buen Fin (mid November)
  if (month === 10 && day >= 15 && day <= 20) return 2.0;

  // Christmas rush (Dec 1-24)
  if (month === 11 && day <= 24) return 1.4 + (day / 24) * 0.5;

  // Back to school (Aug)
  if (month === 7) return 1.25;

  // Valentine's week
  if (month === 1 && day >= 10 && day <= 14) return 1.3;

  // Día de las Madres (May 10)
  if (month === 4 && day >= 7 && day <= 10) return 1.4;

  // Slow January
  if (month === 0) return 0.75;

  // Slow September (post back-to-school)
  if (month === 8) return 0.85;

  return 1.0;
}

// Growth curve for a tenant — organic ramp-up over the 6 months
export function growthMultiplier(dayIndex: number, totalDays: number, profile: string): number {
  const progress = dayIndex / totalDays;

  switch (profile) {
    case 'giant':
      // Already established, slight organic growth
      return 0.95 + progress * 0.10;

    case 'growth':
      // Starts slow, accelerates after plan upgrade (month 3 ≈ day 90)
      if (dayIndex < 90) return 0.4 + (dayIndex / 90) * 0.3;
      return 0.7 + ((dayIndex - 90) / (totalDays - 90)) * 0.5;

    case 'churn':
      // Active month 1, declining month 2, dead after month 2
      if (dayIndex < 30) return 1.0;
      if (dayIndex < 60) return 1.0 - ((dayIndex - 30) / 30) * 0.7;
      return 0.0; // no more sales

    case 'b2c':
      // Steady growth with online focus
      return 0.6 + progress * 0.5;

    case 'stable':
      // Flat, mature business
      return 0.95 + progress * 0.05;

    case 'premium':
      // Consistent with slight seasonal peaks
      return 0.90 + progress * 0.15;

    case 'family':
      // Slow start, late joiner
      return 0.5 + progress * 0.4;

    case 'youth':
      // Strong start, trendy — slight dip mid-period, recovery
      const mid = Math.sin(progress * Math.PI * 2) * 0.1;
      return 0.85 + progress * 0.15 + mid;

    case 'kids':
      // Back-to-school heavy (peaks handled by seasonal), otherwise moderate
      return 0.7 + progress * 0.2;

    case 'formal':
      // Late joiner, slow but steady
      return 0.3 + progress * 0.5;

    default:
      return 1.0;
  }
}

// Combined multiplier for a given day
export function dailyVolumeMultiplier(
  date: Date,
  dayIndex: number,
  totalDays: number,
  profile: string
): number {
  return (
    dayOfWeekMultiplier(date) *
    paydayMultiplier(date) *
    seasonalMultiplier(date) *
    growthMultiplier(dayIndex, totalDays, profile)
  );
}

// Hour distribution for sales — when during the day do sales happen
const HOUR_WEIGHTS = [
  0, 0, 0, 0, 0, 0, 0, 0,       // 00-07: closed
  0.02, 0.05, 0.08, 0.10,        // 08-11: morning ramp
  0.12, 0.14, 0.10, 0.08,        // 12-15: lunch peak
  0.06, 0.08, 0.10, 0.06,        // 16-19: afternoon
  0.04, 0.02, 0, 0,              // 20-23: closing
];

export function randomSaleHour(): number {
  const total = HOUR_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let h = 0; h < 24; h++) {
    r -= HOUR_WEIGHTS[h];
    if (r <= 0) return h;
  }
  return 14;
}

export function randomMinute(): number {
  return Math.floor(Math.random() * 60);
}
