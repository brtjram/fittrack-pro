import { Platform } from 'react-native';
import { saveValue, getValue, removeValue } from './auth-storage';

// HealthKit types we care about
const HK_STEP_COUNT = 'HKQuantityTypeIdentifierStepCount';
const HK_ACTIVE_ENERGY = 'HKQuantityTypeIdentifierActiveEnergyBurned';
const HK_BODY_MASS = 'HKQuantityTypeIdentifierBodyMass';
const HK_HEART_RATE = 'HKQuantityTypeIdentifierHeartRate';

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
  weight: number | null; // in lbs
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
function toDateString(d: Date): string {
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
        if (err || !results) { resolve([]); return; }

        // Aggregate by date in case HealthKit still returns more than one
        // bucket for a calendar day (e.g. DST transitions).
        const byDate = new Map<string, number>();
        for (const r of results) {
          const d = toDateString(new Date(r.startDate));
          byDate.set(d, (byDate.get(d) || 0) + Math.round(r.value));
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
      {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        ascending: true,
      },
      (err: string | null, results: Array<{ startDate: string; value: number }>) => {
        if (err || !results) { resolve([]); return; }

        // Aggregate by date
        const byDate = new Map<string, number>();
        for (const r of results) {
          const d = toDateString(new Date(r.startDate));
          byDate.set(d, (byDate.get(d) || 0) + Math.round(r.value));
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
        if (err || !result) { resolve(null); return; }
        resolve({
          date: toDateString(new Date(result.startDate)),
          value: Math.round(result.value * 10) / 10,
        });
      },
    );
  });
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
        if (err || !results || results.length === 0) { resolve([]); return; }

        // Get the lowest reading per day as a resting estimate
        const byDate = new Map<string, number>();
        for (const r of results) {
          const d = toDateString(new Date(r.startDate));
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

// ==================== Sync ====================

export async function fetchHealthKitData(days = 7): Promise<HealthKitDayData[]> {
  const hk = getHealthKit();
  if (!hk) return [];

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [steps, calories, heartRates, latestWt] = await Promise.all([
    getSteps(startDate, endDate),
    getActiveCalories(startDate, endDate),
    getRestingHeartRate(startDate, endDate),
    getLatestWeight(),
  ]);

  // Merge all data by date
  const dates = new Set<string>();
  steps.forEach((s) => dates.add(s.date));
  calories.forEach((c) => dates.add(c.date));
  heartRates.forEach((h) => dates.add(h.date));

  const stepsMap = new Map(steps.map((s) => [s.date, s.value]));
  const calsMap = new Map(calories.map((c) => [c.date, c.value]));
  const hrMap = new Map(heartRates.map((h) => [h.date, h.value]));

  const result: HealthKitDayData[] = [];
  for (const date of Array.from(dates).sort()) {
    result.push({
      date,
      steps: stepsMap.get(date) || 0,
      activeCalories: calsMap.get(date) || 0,
      restingHeartRate: hrMap.get(date) || null,
      weight: latestWt && latestWt.date === date ? latestWt.value : null,
    });
  }

  return result;
}

export async function syncHealthKitToServer(
  syncActivity: (data: { date: string; steps: number; activeCalories: number; restingHeartRate?: number; source: string }) => Promise<void>,
  syncWeight: (data: { date: string; weightLbs: number }) => Promise<void>,
  days = 7,
): Promise<{ synced: number; errors: number }> {
  const data = await fetchHealthKitData(days);
  let synced = 0;
  let errors = 0;

  for (const day of data) {
    try {
      await syncActivity({
        date: day.date,
        steps: day.steps,
        activeCalories: day.activeCalories,
        ...(day.restingHeartRate ? { restingHeartRate: day.restingHeartRate } : {}),
        source: 'healthkit',
      });
      synced++;

      // Also sync weight if available
      if (day.weight) {
        await syncWeight({ date: day.date, weightLbs: day.weight });
      }
    } catch (e) {
      console.warn('HealthKit sync error for', day.date, e);
      errors++;
    }
  }

  // Record last sync time
  await saveValue(HEALTHKIT_LAST_SYNC_KEY, new Date().toISOString());

  return { synced, errors };
}
