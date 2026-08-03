import { Platform } from 'react-native';
import { saveValue, getValue, removeValue } from './auth-storage';

// HealthKit types we care about
const HK_STEP_COUNT = 'HKQuantityTypeIdentifierStepCount';
const HK_ACTIVE_ENERGY = 'HKQuantityTypeIdentifierActiveEnergyBurned';
const HK_BODY_MASS = 'HKQuantityTypeIdentifierBodyMass';
const HK_HEART_RATE = 'HKQuantityTypeIdentifierHeartRate';
const HK_SLEEP_ANALYSIS = 'HKCategoryTypeIdentifierSleepAnalysis';

// Sleep sample values that represent time actually asleep — excludes
// "INBED" (in bed but not necessarily asleep) and "AWAKE" (woke up during
// the night). Covers both the legacy single-stage API ("ASLEEP") and the
// watchOS 9+ sleep-stage API (CORE/DEEP/REM), per react-native-health's
// RCTAppleHealthKit+Queries.m value mapping.
const ASLEEP_VALUES = new Set(['ASLEEP', 'CORE', 'DEEP', 'REM']);

const HEALTHKIT_ENABLED_KEY = 'healthkit_enabled';
const HEALTHKIT_LAST_SYNC_KEY = 'healthkit_last_sync';

// Lazy-load react-native-health to avoid crashes on non-iOS
let AppleHealthKit: any = null;

function getHealthKit() {
  if (Platform.OS !== 'ios') return null;
  if (!AppleHealthKit) {
    try {
      // react-native-health's index.js does `module.exports = HealthKit` —
      // a plain CommonJS export with no `.default` — so `.default` here was
      // always undefined, making every call silently report unavailable.
      AppleHealthKit = require('react-native-health');
    } catch {
      return null;
    }
  }
  return AppleHealthKit;
}

export interface HealthKitDayData {
  date: string;
  steps: number;
  activeCalories: number;
  restingHeartRate: number | null;
  sleepHours: number | null;
  weight: number | null; // in lbs
  bodyFatPercent: number | null;
}

export interface HealthKitBodyMetrics {
  heightCm: number | null;
  bodyFatPercent: number | null;
}

export interface HealthKitStatus {
  available: boolean;
  enabled: boolean;
  lastSync: string | null;
}

// ==================== Status ====================

export async function getHealthKitStatus(): Promise<HealthKitStatus> {
  const hk = getHealthKit();
  if (!hk) return { available: false, enabled: false, lastSync: null };

  const isAvailable = await new Promise<boolean>((resolve) => {
    try {
      hk.isAvailable((error: string | null, available: boolean) => {
        resolve(!error && available);
      });
    } catch {
      resolve(false);
    }
  });

  if (!isAvailable) return { available: false, enabled: false, lastSync: null };

  const enabled = (await getValue(HEALTHKIT_ENABLED_KEY)) === 'true';
  const lastSync = await getValue(HEALTHKIT_LAST_SYNC_KEY);
  return { available: true, enabled, lastSync };
}

export async function setHealthKitEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await saveValue(HEALTHKIT_ENABLED_KEY, 'true');
  } else {
    await removeValue(HEALTHKIT_ENABLED_KEY);
  }
}

// ==================== Permissions ====================

export function requestHealthKitPermissions(): Promise<boolean> {
  return new Promise((resolve) => {
    const hk = getHealthKit();
    if (!hk) { resolve(false); return; }

    const permissions = {
      permissions: {
        read: [
          hk.Constants.Permissions.Steps,
          hk.Constants.Permissions.ActiveEnergyBurned,
          hk.Constants.Permissions.BodyMass,
          hk.Constants.Permissions.HeartRate,
          hk.Constants.Permissions.BodyFatPercentage,
          hk.Constants.Permissions.Height,
          hk.Constants.Permissions.SleepAnalysis,
        ],
        write: [],
      },
    };

    hk.initHealthKit(permissions, (error: string | null) => {
      if (error) {
        console.warn('HealthKit permission denied:', error);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

// ==================== Data Queries ====================

// HealthKit buckets samples by the device's local calendar day (e.g. a
// startDate of local midnight), so converting through toISOString() here
// would shift the date across the UTC boundary for any non-UTC timezone —
// e.g. evening steps landing on "tomorrow", making "today" look like 0.
function toDateString(d: Date): string | null {
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getSteps(startDate: Date, endDate: Date): Promise<{ date: string; value: number }[]> {
  return new Promise((resolve) => {
    const hk = getHealthKit();
    if (!hk) { resolve([]); return; }

    // react-native-health's `period` option is in minutes and defaults to 60
    // (hourly buckets), despite the method being named getDailyStepCountSamples.
    // Without an explicit 1440 (24h) here, HealthKit returns ~24 rows per day
    // and only the last hourly bucket survives the by-date merge below,
    // making "today's steps" look like a single hour's worth.
    hk.getDailyStepCountSamples(
      { startDate: startDate.toISOString(), endDate: endDate.toISOString(), period: 24 * 60 },
      (err: string | null, results: Array<{ startDate: string; value: number }>) => {
        if (err) console.warn('HealthKit getDailyStepCountSamples error:', err);
        if (err || !results) { resolve([]); return; }

        // With period=24h HealthKit should return exactly one bucket per
        // calendar day, but a phone + paired Watch both recording steps can
        // still surface as more than one row landing on the same local day
        // (each already a same-day cumulative total, not a disjoint slice).
        // Summing those double/triple-counts the day — e.g. a real 7,388
        // step day reporting as 12,912. Taking the max is a no-op in the
        // normal single-row case and avoids the inflation in the multi-row
        // case, at the cost of (rarely) undercounting a day that
        // legitimately split into non-overlapping partial buckets.
        const byDate = new Map<string, number>();
        for (const r of results) {
          const d = toDateString(new Date(r.startDate));
          if (d === null) continue;
          byDate.set(d, Math.max(byDate.get(d) || 0, Math.round(r.value)));
        }
        resolve(Array.from(byDate.entries()).map(([date, value]) => ({ date, value })));
      },
    );
  });
}

function getActiveCalories(startDate: Date, endDate: Date): Promise<{ date: string; value: number }[]> {
  return new Promise((resolve) => {
    const hk = getHealthKit();
    if (!hk) { resolve([]); return; }

    hk.getActiveEnergyBurned(
      // Same period bug as getSteps: react-native-health's native query
      // defaults `period` to 60 (hourly buckets) when it's omitted. Each
      // hourly bucket is that hour's own sum (not a running daily total),
      // so without period=24h the by-date merge below — which takes the
      // max across rows to dedupe phone+Watch sources — was keeping only
      // the single highest-burning hour of the day instead of the full-day
      // total, e.g. a real ~180 kcal day reporting as ~40 kcal.
      {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        period: 24 * 60,
        ascending: true,
      },
      (err: string | null, results: Array<{ startDate: string; value: number }>) => {
        if (err) console.warn('HealthKit getActiveEnergyBurned error:', err);
        if (err || !results) { resolve([]); return; }

        // Same multi-source-per-day risk as getSteps above — take the max
        // rather than summing so a phone+Watch pair can't double-count.
        const byDate = new Map<string, number>();
        for (const r of results) {
          const d = toDateString(new Date(r.startDate));
          if (d === null) continue;
          byDate.set(d, Math.max(byDate.get(d) || 0, Math.round(r.value)));
        }
        resolve(Array.from(byDate.entries()).map(([date, value]) => ({ date, value })));
      },
    );
  });
}

function getLatestWeight(): Promise<{ date: string; value: number } | null> {
  return new Promise((resolve) => {
    const hk = getHealthKit();
    if (!hk) { resolve(null); return; }

    hk.getLatestWeight(
      { unit: 'pound' },
      (err: string | null, result: { value: number; startDate: string }) => {
        if (err) console.warn('HealthKit getLatestWeight error:', err);
        const date = result ? toDateString(new Date(result.startDate)) : null;
        if (err || !result || date === null) { resolve(null); return; }
        resolve({
          date,
          value: Math.round(result.value * 10) / 10,
        });
      },
    );
  });
}

function getLatestBodyFat(): Promise<{ date: string; value: number } | null> {
  return new Promise((resolve) => {
    const hk = getHealthKit();
    if (!hk) { resolve(null); return; }

    // The native module's percentUnit path already scales to 0-100 before
    // it reaches JS (see RCTAppleHealthKit+Methods_Body.m), so `value` here
    // is a percentage like 22.5, not a 0-1 fraction — no further scaling.
    hk.getLatestBodyFatPercentage(
      {},
      (err: string | null, result: { value: number; startDate: string }) => {
        if (err) console.warn('HealthKit getLatestBodyFatPercentage error:', err);
        const date = result ? toDateString(new Date(result.startDate)) : null;
        if (err || !result || date === null) { resolve(null); return; }
        resolve({ date, value: Math.round(result.value * 10) / 10 });
      },
    );
  });
}

function getLatestHeight(): Promise<{ date: string; value: number } | null> {
  return new Promise((resolve) => {
    const hk = getHealthKit();
    if (!hk) { resolve(null); return; }

    hk.getLatestHeight(
      { unit: 'meter' },
      (err: string | null, result: { value: number; startDate: string }) => {
        if (err) console.warn('HealthKit getLatestHeight error:', err);
        const date = result ? toDateString(new Date(result.startDate)) : null;
        if (err || !result || date === null) { resolve(null); return; }
        resolve({ date, value: Math.round(result.value * 100) });
      },
    );
  });
}

// One-shot read for profile-shaped fields (height, body fat) that a settings
// screen wants immediately, independent of the per-day activity/weight sync
// loop below — there's no "day" a height reading belongs to.
export async function getLatestBodyMetrics(): Promise<HealthKitBodyMetrics> {
  const [height, bodyFat] = await Promise.all([getLatestHeight(), getLatestBodyFat()]);
  return {
    heightCm: height?.value ?? null,
    bodyFatPercent: bodyFat?.value ?? null,
  };
}

function getRestingHeartRate(startDate: Date, endDate: Date): Promise<{ date: string; value: number }[]> {
  return new Promise((resolve) => {
    const hk = getHealthKit();
    if (!hk) { resolve([]); return; }

    hk.getHeartRateSamples(
      {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        ascending: true,
      },
      (err: string | null, results: Array<{ startDate: string; value: number }>) => {
        if (err) console.warn('HealthKit getHeartRateSamples error:', err);
        if (err || !results || results.length === 0) { resolve([]); return; }

        // Get the lowest reading per day as a resting estimate
        const byDate = new Map<string, number>();
        for (const r of results) {
          const d = toDateString(new Date(r.startDate));
          if (d === null) continue;
          const existing = byDate.get(d);
          if (!existing || r.value < existing) {
            byDate.set(d, Math.round(r.value));
          }
        }
        resolve(Array.from(byDate.entries()).map(([date, value]) => ({ date, value })));
      },
    );
  });
}

function getSleepAnalysis(startDate: Date, endDate: Date): Promise<{ date: string; value: number }[]> {
  return new Promise((resolve) => {
    const hk = getHealthKit();
    if (!hk) { resolve([]); return; }

    hk.getSleepSamples(
      { startDate: startDate.toISOString(), endDate: endDate.toISOString(), ascending: true },
      (err: string | null, results: Array<{ startDate: string; endDate: string; value: string }>) => {
        if (err) console.warn('HealthKit getSleepSamples error:', err);
        if (err || !results) { resolve([]); return; }

        // A night's sleep is bucketed by the day it ends on (wake-up day),
        // not the day it started — an 11pm-7am session should count toward
        // "today", the day the user actually experiences the rest, matching
        // how Apple's own Health app attributes sleep. In-bed and awake
        // samples overlap with asleep samples for the same session, so only
        // ASLEEP_VALUES rows are counted to avoid double-counting duration.
        const minutesByDate = new Map<string, number>();
        for (const r of results) {
          if (!ASLEEP_VALUES.has(r.value)) continue;
          const d = toDateString(new Date(r.endDate));
          if (d === null) continue;
          const minutes = (new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 60000;
          if (minutes <= 0) continue;
          minutesByDate.set(d, (minutesByDate.get(d) || 0) + minutes);
        }
        resolve(Array.from(minutesByDate.entries()).map(([date, minutes]) => ({ date, value: Math.round((minutes / 60) * 10) / 10 })));
      },
    );
  });
}

// ==================== Sync ====================

export async function fetchHealthKitData(days = 7): Promise<HealthKitDayData[]> {
  const hk = getHealthKit();
  if (!hk) return [];

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [steps, calories, heartRates, sleep, latestWt, latestBodyFat] = await Promise.all([
    getSteps(startDate, endDate),
    getActiveCalories(startDate, endDate),
    getRestingHeartRate(startDate, endDate),
    getSleepAnalysis(startDate, endDate),
    getLatestWeight(),
    getLatestBodyFat(),
  ]);

  // Merge all data by date — includes the weight/body-fat dates too (not
  // just steps/calories/heart-rate/sleep), otherwise a weigh-in or body-fat
  // reading on a day with no other Health data silently never made it into
  // `result` at all.
  const dates = new Set<string>();
  steps.forEach((s) => dates.add(s.date));
  calories.forEach((c) => dates.add(c.date));
  heartRates.forEach((h) => dates.add(h.date));
  sleep.forEach((s) => dates.add(s.date));
  if (latestWt) dates.add(latestWt.date);
  if (latestBodyFat) dates.add(latestBodyFat.date);

  const stepsMap = new Map(steps.map((s) => [s.date, s.value]));
  const calsMap = new Map(calories.map((c) => [c.date, c.value]));
  const hrMap = new Map(heartRates.map((h) => [h.date, h.value]));
  const sleepMap = new Map(sleep.map((s) => [s.date, s.value]));

  const result: HealthKitDayData[] = [];
  for (const date of Array.from(dates).sort()) {
    result.push({
      date,
      steps: stepsMap.get(date) || 0,
      activeCalories: calsMap.get(date) || 0,
      restingHeartRate: hrMap.get(date) || null,
      sleepHours: sleepMap.get(date) || null,
      weight: latestWt && latestWt.date === date ? latestWt.value : null,
      bodyFatPercent: latestBodyFat && latestBodyFat.date === date ? latestBodyFat.value : null,
    });
  }

  return result;
}

export async function syncHealthKitToServer(
  syncActivity: (data: { date: string; steps: number; activeCalories: number; restingHeartRate?: number; sleepHours?: number; source: string }) => Promise<void>,
  syncWeight: (data: { date: string; weightLbs: number; bodyFatPercent?: number }) => Promise<void>,
  days = 7,
): Promise<{ synced: number; errors: number; hasData: boolean }> {
  const data = await fetchHealthKitData(days);
  let synced = 0;
  let errors = 0;
  // Distinguishes "Health genuinely has nothing yet" from "Health returned
  // nothing at all" — the latter usually means a data type's read permission
  // was silently denied (iOS grants/denies per-type without surfacing which),
  // so the UI can tell the user to go check Settings instead of pretending
  // the sync was healthy.
  const hasData = data.some((day) => day.steps > 0 || day.activeCalories > 0 || day.restingHeartRate != null || day.sleepHours != null || day.weight != null || day.bodyFatPercent != null);

  for (const day of data) {
    try {
      await syncActivity({
        date: day.date,
        steps: day.steps,
        activeCalories: day.activeCalories,
        ...(day.restingHeartRate ? { restingHeartRate: day.restingHeartRate } : {}),
        ...(day.sleepHours ? { sleepHours: day.sleepHours } : {}),
        source: 'healthkit',
      });
      synced++;

      // Body fat only means something attached to an actual weigh-in, so it
      // rides along with the weight sync rather than getting its own call.
      if (day.weight) {
        await syncWeight({
          date: day.date,
          weightLbs: day.weight,
          ...(day.bodyFatPercent ? { bodyFatPercent: day.bodyFatPercent } : {}),
        });
      }
    } catch (e) {
      console.warn('HealthKit sync error for', day.date, e);
      errors++;
    }
  }

  // Record last sync time
  await saveValue(HEALTHKIT_LAST_SYNC_KEY, new Date().toISOString());

  return { synced, errors, hasData };
}
