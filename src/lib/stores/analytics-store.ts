import type { DailyActivity } from '@/types';

export async function getDailyActivities(limit = 90): Promise<DailyActivity[]> {
  const res = await fetch(`/api/fitness/activities?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function addDailyActivity(activity: Omit<DailyActivity, 'id'>): Promise<void> {
  await fetch('/api/fitness/activities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(activity),
  });
}

export async function updateDailyActivity(originalDate: string, activity: Omit<DailyActivity, 'id'>): Promise<void> {
  await fetch('/api/fitness/activities', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originalDate, ...activity }),
  });
}

export async function getDailyActivityByDate(date: string): Promise<DailyActivity | undefined> {
  const res = await fetch(`/api/fitness/activities?date=${date}`);
  if (!res.ok) return undefined;
  const data = await res.json();
  return data ?? undefined;
}

export async function getActivitiesByDateRange(startDate: string, endDate: string): Promise<DailyActivity[]> {
  const res = await fetch(`/api/fitness/activities?startDate=${startDate}&endDate=${endDate}`);
  if (!res.ok) return [];
  return res.json();
}
