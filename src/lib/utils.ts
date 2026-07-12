import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Our date-only strings (from toDateString below) are plain "YYYY-MM-DD" with
// no time component. `new Date("2026-07-12")` parses that as UTC midnight, so
// formatting it in any timezone behind UTC (e.g. US Pacific) rolls it back to
// the previous calendar day. Parse the Y/M/D parts directly into local time
// instead, so the displayed date always matches what was actually stored.
export function parseDateOnly(dateStr: string): Date {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseDateOnly(date) : date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? parseDateOnly(date) : date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function toDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function roundTo(num: number, decimals: number): number {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Safely parse exercises stored as JSON (handles single and double encoding) */
export function parseExercises(raw: unknown): unknown[] {
  let v = raw;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return []; } }
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return []; } }
  return Array.isArray(v) ? v : [];
}

export function movingAverage(values: number[], window: number): number {
  if (values.length === 0) return 0;
  const slice = values.slice(-window);
  return slice.reduce((sum, v) => sum + v, 0) / slice.length;
}
