import type { WeightUnit, HeightUnit, EnergyUnit, WeekStart } from '../types';

const LB_PER_KG = 2.20462;
const KCAL_PER_KJ = 0.239006;

// Raw numeric conversion, separate from formatWeight's string output — for
// callers that need the number on its own (a chart axis, a big headline
// figure with its unit rendered as a separate smaller label) rather than
// pre-glued to a unit suffix.
export function convertWeight(lbs: number, unit: WeightUnit = 'lb'): number {
  const converted = unit === 'kg' ? lbs / LB_PER_KG : lbs;
  return Math.round(converted * 10) / 10;
}

export function formatWeight(lbs: number, unit: WeightUnit = 'lb'): string {
  return `${convertWeight(lbs, unit).toFixed(1)} ${unit}`;
}

export function formatHeight(cm: number, unit: HeightUnit = 'cm'): string {
  if (unit === 'ftin') {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return `${feet}'${inches}"`;
  }
  return `${Math.round(cm)} cm`;
}

export function formatEnergy(kcal: number, unit: EnergyUnit = 'kcal'): string {
  if (unit === 'kj') return `${Math.round(kcal / KCAL_PER_KJ).toLocaleString()} kJ`;
  return `${Math.round(kcal).toLocaleString()} kcal`;
}

// Sunday-indexed (0=Sun..6=Sat) week-start offset, matching Date#getDay().
export function weekStartDayIndex(pref: WeekStart = 'mon'): number {
  return pref === 'sun' ? 0 : 1;
}

export function startOfWeek(date: Date, pref: WeekStart = 'mon'): Date {
  const target = weekStartDayIndex(pref);
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day - target + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
