import type {
  UserProfile, WorkoutSession, PersonalRecord,
  FoodLogEntry, WeightEntry, DailyActivity,
  NutritionAdjustment, FoodItem,
} from '@fittrack/core';
import { getToken } from './auth-storage';

const API_BASE = __DEV__
  ? 'http://localhost:3000'
  : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myfittrack.pro');

// A 401 means the stored token doesn't correspond to a valid session anymore
// (expired, or its user no longer exists) — retrying or surfacing it as a
// generic error just leaves the user stuck, so let whoever holds the auth
// state (useAuth) know to log them out and send them back to the login screen.
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

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
      if (res.status === 401 && token) unauthorizedHandler?.();
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

async function throwIfNotOk(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;
  const data = await res.json().catch(() => ({}));
  throw new Error(data.error || `${fallback} (${res.status})`);
}

// ==================== Auth ====================

export async function registerUser(name: string, email: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Registration failed');
  }
}

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
  const res = await apiFetch('/api/fitness/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Could not save profile (${res.status})`);
  }
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
  const res = await apiFetch('/api/fitness/workouts', {
    method: 'POST',
    body: JSON.stringify(session),
  });
  await throwIfNotOk(res, 'Could not save workout');
}

export async function deleteWorkout(sessionId: string): Promise<void> {
  const res = await apiFetch(`/api/fitness/workouts?sessionId=${sessionId}`, { method: 'DELETE' });
  await throwIfNotOk(res, 'Could not delete workout');
}

export async function generateWorkout(): Promise<WorkoutSession | undefined> {
  const res = await apiFetch('/api/fitness/workouts/generate', { method: 'POST' });
  if (!res.ok) return undefined;
  return parseWorkoutSession(await res.json());
}

export async function generateWeekWorkouts(): Promise<WorkoutSession[]> {
  const res = await apiFetch('/api/fitness/workouts/generate-week', { method: 'POST' });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data.map(parseWorkoutSession) : [];
}

// ==================== Personal Records ====================

export async function getPersonalRecords(exerciseId?: string): Promise<PersonalRecord[]> {
  const params = exerciseId ? `?exerciseId=${exerciseId}` : '';
  const res = await apiFetch(`/api/fitness/personal-records${params}`);
  if (!res.ok) return [];
  return res.json();
}

export async function savePersonalRecord(record: Omit<PersonalRecord, 'id'>): Promise<void> {
  const res = await apiFetch('/api/fitness/personal-records', {
    method: 'POST',
    body: JSON.stringify(record),
  });
  await throwIfNotOk(res, 'Could not save personal record');
}

// ==================== Nutrition ====================

export async function getFoodLogByDate(date: string): Promise<FoodLogEntry[]> {
  const res = await apiFetch(`/api/fitness/food-log?date=${date}`);
  if (!res.ok) return [];
  return res.json();
}

export async function addFoodLogEntry(entry: Omit<FoodLogEntry, 'id'>): Promise<void> {
  const res = await apiFetch('/api/fitness/food-log', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
  await throwIfNotOk(res, 'Could not log food');
}

export async function deleteFoodLogEntry(id: string): Promise<void> {
  const res = await apiFetch(`/api/fitness/food-log?id=${id}`, { method: 'DELETE' });
  await throwIfNotOk(res, 'Could not delete food entry');
}

export async function updateFoodLogEntry(id: string, patch: Partial<Omit<FoodLogEntry, 'id'>>): Promise<void> {
  const res = await apiFetch('/api/fitness/food-log', {
    method: 'PUT',
    body: JSON.stringify({ id, ...patch }),
  });
  await throwIfNotOk(res, 'Could not update food entry');
}

export interface AnalyzedFoodItem {
  name: string;
  servingDescription: string;
  servingSizeG: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: 'high' | 'medium' | 'low';
}

export async function analyzeFoodPhoto(
  base64Image: string,
  mediaType: string,
  description?: string,
): Promise<{ items: AnalyzedFoodItem[]; notes?: string }> {
  const res = await apiFetch('/api/fitness/food-log/analyze-photo', {
    method: 'POST',
    body: JSON.stringify({ image: base64Image, mediaType, description }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Photo analysis failed.');
  }
  return res.json();
}

export async function analyzeFoodText(description: string): Promise<{ items: AnalyzedFoodItem[]; notes?: string }> {
  const res = await apiFetch('/api/fitness/food-log/analyze-text', {
    method: 'POST',
    body: JSON.stringify({ description }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not analyze that description.');
  }
  return res.json();
}

export async function getRecentFoods(meal?: string, limit = 10): Promise<FoodItem[]> {
  const params = new URLSearchParams({ limit: String(limit), ...(meal ? { meal } : {}) });
  const res = await apiFetch(`/api/fitness/food-log/recent?${params.toString()}`);
  if (!res.ok) return [];
  return res.json();
}

// ==================== Weight ====================

export async function getWeightEntries(limit = 90): Promise<WeightEntry[]> {
  const res = await apiFetch(`/api/fitness/weight?limit=${limit}`);
  if (!res.ok) return [];
  return res.json();
}

export async function addWeightEntry(entry: Omit<WeightEntry, 'id'>): Promise<void> {
  const res = await apiFetch('/api/fitness/weight', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
  await throwIfNotOk(res, 'Could not save weigh-in');
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
  const res = await apiFetch('/api/fitness/activities', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  await throwIfNotOk(res, 'Could not save activity');
}

// ==================== Nutrition Adjustments ====================

export async function getNutritionAdjustments(): Promise<NutritionAdjustment[]> {
  const res = await apiFetch('/api/fitness/nutrition-adjustments');
  if (!res.ok) return [];
  return res.json();
}

// ==================== Push Tokens ====================

export async function registerPushToken(token: string, platform = 'ios'): Promise<void> {
  const res = await apiFetch('/api/fitness/push-tokens', {
    method: 'POST',
    body: JSON.stringify({ token, platform }),
  });
  await throwIfNotOk(res, 'Could not register push token');
}

export async function removePushToken(token: string): Promise<void> {
  const res = await apiFetch(`/api/fitness/push-tokens?token=${encodeURIComponent(token)}`, {
    method: 'DELETE',
  });
  await throwIfNotOk(res, 'Could not remove push token');
}

// ==================== Notification Preferences ====================

export interface NotificationPrefs {
  enabled: boolean;
  workoutReminder: boolean;
  workoutReminderHour: number;
  workoutReminderMinute: number;
  breakfastReminder: boolean;
  breakfastHour: number;
  breakfastMinute: number;
  lunchReminder: boolean;
  lunchHour: number;
  lunchMinute: number;
  dinnerReminder: boolean;
  dinnerHour: number;
  dinnerMinute: number;
  weighInReminder: boolean;
  weighInDay: number;
  weighInHour: number;
  weighInMinute: number;
  quietHoursEnabled: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
}

export async function getNotificationPreferences(): Promise<NotificationPrefs> {
  const res = await apiFetch('/api/fitness/notification-preferences');
  if (!res.ok) {
    // Return defaults on error
    return {
      enabled: true, workoutReminder: true, workoutReminderHour: 9, workoutReminderMinute: 0,
      breakfastReminder: true, breakfastHour: 8, breakfastMinute: 0,
      lunchReminder: true, lunchHour: 12, lunchMinute: 0,
      dinnerReminder: true, dinnerHour: 18, dinnerMinute: 0,
      weighInReminder: true, weighInDay: 1, weighInHour: 8, weighInMinute: 0,
      quietHoursEnabled: false, quietHoursStart: 22, quietHoursEnd: 7,
    };
  }
  return res.json();
}

export async function saveNotificationPreferences(prefs: Partial<NotificationPrefs>): Promise<void> {
  const res = await apiFetch('/api/fitness/notification-preferences', {
    method: 'PUT',
    body: JSON.stringify(prefs),
  });
  await throwIfNotOk(res, 'Could not save notification preferences');
}

// ==================== Transformation Challenge ====================

export interface TransformationChallenge {
  id: string;
  startDate: string;
  startWeightLbs: number;
  targetWeightLbs: number;
  currentWeek: number;
  isActive: boolean;
  weeklyData: Array<{
    week: number;
    endWeight?: number;
    avgDailySteps?: number;
    workoutsCompleted?: number;
    workoutsTargeted?: number;
    foodComplianceDays?: number;
    notes?: string;
  }>;
}

export async function getTransformationChallenge(): Promise<TransformationChallenge | null> {
  const res = await apiFetch('/api/fitness/transformation-challenge');
  if (!res.ok) return null;
  return res.json();
}

export async function startTransformationChallenge(targetWeightLbs?: number): Promise<TransformationChallenge> {
  const res = await apiFetch('/api/fitness/transformation-challenge', {
    method: 'POST',
    body: JSON.stringify({ targetWeightLbs }),
  });
  if (!res.ok) throw new Error('Failed to start challenge');
  return res.json();
}

export async function updateTransformationChallenge(data: {
  currentWeek?: number;
  isActive?: boolean;
  weeklyCheckIn?: {
    week: number;
    endWeight?: number;
    avgDailySteps?: number;
    workoutsCompleted?: number;
    workoutsTargeted?: number;
    foodComplianceDays?: number;
    notes?: string;
  };
}): Promise<TransformationChallenge> {
  const res = await apiFetch('/api/fitness/transformation-challenge', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update challenge');
  return res.json();
}

export async function endTransformationChallenge(): Promise<void> {
  const res = await apiFetch('/api/fitness/transformation-challenge', { method: 'DELETE' });
  await throwIfNotOk(res, 'Could not end challenge');
}

// ==================== Data Export ====================

export type ExportSection = 'meals' | 'workouts' | 'weighins';

export async function exportData(opts: {
  format: 'csv' | 'json';
  range: '90' | 'all';
  sections: ExportSection[];
}): Promise<{ content: string; filename: string; mimeType: string }> {
  const params = new URLSearchParams({ format: opts.format, range: opts.range, sections: opts.sections.join(',') });
  const res = await apiFetch(`/api/fitness/export?${params.toString()}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Export failed.');
  }
  const content = await res.text();
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? `fittrack-export.${opts.format}`;
  const mimeType = res.headers.get('content-type') ?? (opts.format === 'json' ? 'application/json' : 'text/csv');
  return { content, filename, mimeType };
}

// ==================== USDA Food Search ====================

export async function searchUSDAFoods(query: string): Promise<FoodItem[]> {
  if (query.length < 2) return [];
  const res = await apiFetch(`/api/food-search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  return res.json();
}
