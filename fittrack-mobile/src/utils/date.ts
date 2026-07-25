// `Date#toISOString()` always returns the UTC calendar date, which silently
// rolls over to "tomorrow" every evening in any timezone west of UTC (e.g.
// after ~5pm Pacific). Use local Y/M/D components instead for anything that
// means "today" or "this calendar day" on the device. Mirrors the web app's
// src/lib/utils.ts#toDateString, which got this fix; the mobile app had its
// own independent (broken) copy in five different files.
export function toDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
