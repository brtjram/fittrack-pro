import type { WorkoutSession, PersonalRecord } from '@/types';
import { parseExercises } from '@/lib/utils';

export async function getRecentWorkouts(limit = 20): Promise<WorkoutSession[]> {
  const res = await fetch(`/api/fitness/workouts?limit=${limit}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.map(parseWorkoutSession);
}

export async function getWorkoutById(sessionId: string): Promise<WorkoutSession | undefined> {
  const res = await fetch(`/api/fitness/workouts?sessionId=${sessionId}`);
  if (!res.ok) return undefined;
  const data = await res.json();
  return data ? parseWorkoutSession(data) : undefined;
}

export async function saveWorkout(session: WorkoutSession): Promise<void> {
  await fetch('/api/fitness/workouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  });
}

export async function deleteWorkout(sessionId: string): Promise<void> {
  await fetch(`/api/fitness/workouts?sessionId=${sessionId}`, { method: 'DELETE' });
}

export async function getCompletedWorkouts(): Promise<WorkoutSession[]> {
  const all = await getRecentWorkouts(100);
  return all.filter((s) => s.completed);
}

export async function getWorkoutsByDateRange(startDate: string, endDate: string): Promise<WorkoutSession[]> {
  const res = await fetch(`/api/fitness/workouts?startDate=${startDate}&endDate=${endDate}&limit=200`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.map(parseWorkoutSession);
}

// Personal Records
export async function getPersonalRecords(exerciseId?: string): Promise<PersonalRecord[]> {
  const params = exerciseId ? `?exerciseId=${exerciseId}` : '';
  const res = await fetch(`/api/fitness/personal-records${params}`);
  if (!res.ok) return [];
  return res.json();
}

export async function savePersonalRecord(record: Omit<PersonalRecord, 'id'>): Promise<void> {
  await fetch('/api/fitness/personal-records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
}

export async function getLatestPRs(): Promise<Map<string, PersonalRecord>> {
  const allPRs = await getPersonalRecords();
  const prMap = new Map<string, PersonalRecord>();

  for (const pr of allPRs) {
    const existing = prMap.get(pr.exerciseId);
    if (!existing || pr.weight * (36 / (37 - pr.reps)) > existing.weight * (36 / (37 - existing.reps))) {
      prMap.set(pr.exerciseId, pr);
    }
  }

  return prMap;
}

function parseWorkoutSession(raw: Record<string, unknown>): WorkoutSession {
  return { ...raw, exercises: parseExercises(raw.exercises) } as unknown as WorkoutSession;
}
