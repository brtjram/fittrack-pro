import type {
  UserProfile, WorkoutSession, PersonalRecord,
  FoodLogEntry, WeightEntry, DailyActivity,
  NutritionAdjustment, FoodItem,
} from '@fittrack/core';
import { getToken } from './auth-storage';

// Change this to your deployed Vercel URL
const API_BASE = __DEV__
  ? 'http://localhost:3000'
  : 'https://your-app.vercel.app';

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  // Retry with exponential backoff for network failures
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
      // Don't retry on client errors (4xx), only on server errors or network failures
      if (res.ok || (res.status >= 400 && res.status < 500)) return res;
      lastError = new Error(`Server error: ${res.status}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('Network request failed');
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
  }
  throw lastError ?? new Error('Request failed after retries');
}

// ==================== Auth ====================

export async function loginWithCredentials(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/mobile-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Login failed');
  }
  return res.json() as Promise<{ token: string; user: { id: string; name: string; email: string; image?: string } }>;
}

// ==================== Profile ====================

export async function getUserProfile(): Promise<UserProfile | undefined> {
  const res = await apiFetch('/api/fitness/profile');
  if (!res.ok) return undefined;
  const data = await res.json();
  return data ?? undefined;
}

export async function saveUserProfile(profile: Partial<UserProfile>): Promise<void> {
  await apiFetch('/api/fitness/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}

// ==================== Workouts ====================

function parseWorkoutSession(raw: Record<string, unknown>): WorkoutSession {
  return {
    ...raw,
    exercises: typeof raw.exercises === 'string' ? JSON.parse(raw.exercises as string) : raw.exercises,
  } as unknown as WorkoutSession;
}

export async function getRecentWorkouts(limit = 20): Promise<WorkoutSession[]> {
  const res = await apiFetch(`/api/fitness/workouts?limit=${limit}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.map(parseWorkoutSession);
}

export async function getWorkoutById(sessionId: string): Promise<WorkoutSession | undefined> {
  const res = await apiFetch(`/api/fitness/workouts?sessionId=${sessionId}`);
  if (!res.ok) return undefined;
  const data = await res.json();
  return data ? parseWorkoutSession(data) : undefined;
}

export async function saveWorkout(session: WorkoutSession): Promise<void> {
  await apiFetch('/api/fitness/workouts', {
    method: 'POST',
    body: JSON.stringify(session),
  });
}

export async function deleteWorkout(sessionId: string): Promise<void> {
  await apiFetch(`/api/fitness/workouts?sessionId=${sessionId}`, { method: 'DELETE' });
}

// ==================== Personal Records ====================

export async function getPersonalRecords(exerciseId?: string): Promise<PersonalRecord[]> {
  const params = exerciseId ? `?exerciseId=${exerciseId}` : '';
  const res = await apiFetch(`/api/fitness/personal-records${params}`);
  if (!res.ok) return [];
  return res.json();
}

export async function savePersonalRecord(record: Omit<PersonalRecord, 'id'>): Promise<void> {
  await apiFetch('/api/fitness/personal-records', {
    method: 'POST',
    body: JSON.stringify(record),
  });
}

// ==================== Nutrition ====================

export async function getFoodLogByDate(date: string): Promise<FoodLogEntry[]> {
  const res = await apiFetch(`/api/fitness/food-log?date=${date}`);
  if (!res.ok) return [];
  return res.json();
}

export async function addFoodLogEntry(entry: Omit<FoodLogEntry, 'id'>): Promise<void> {
  await apiFetch('/api/fitness/food-log', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export async function deleteFoodLogEntry(id: string): Promise<void> {
  await apiFetch(`/api/fitness/food-log?id=${id}`, { method: 'DELETE' });
}

// ==================== Weight ====================

export async function getWeightEntries(limit = 90): Promise<WeightEntry[]> {
  const res = await apiFetch(`/api/fitness/weight?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function addWeightEntry(entry: Omit<WeightEntry, 'id'>): Promise<void> {
  await apiFetch('/api/fitness/weight', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

// ==================== Activities ====================

export async function getDailyActivities(limit = 90): Promise<DailyActivity[]> {
  const res = await apiFetch(`/api/fitness/activities?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function saveDailyActivity(data: {
  date: string;
  steps: number;
  activeCalories: number;
  restingHeartRate?: number;
  source?: string;
}): Promise<void> {
  await apiFetch('/api/fitness/activities', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ==================== Nutrition Adjustments ====================

export async function getNutritionAdjustments(): Promise<NutritionAdjustment[]> {
  const res = await apiFetch('/api/fitness/nutrition-adjustments');
  if (!res.ok) return [];
  return res.json();
}

// ==================== Push Tokens ====================

export async function registerPushToken(token: string, platform = 'ios'): Promise<void> {
  await apiFetch('/api/fitness/push-tokens', {
    method: 'POST',
    body: JSON.stringify({ token, platform }),
  });
}

export async function removePushToken(token: string): Promise<void> {
  await apiFetch(`/api/fitness/push-tokens?token=${encodeURIComponent(token)}`, {
    method: 'DELETE',
  });
}

// ==================== USDA Food Search ====================

export async function searchUSDAFoods(query: string): Promise<FoodItem[]> {
  if (query.length < 2) return [];
  const res = await apiFetch(`/api/food-search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  return res.json();
}
