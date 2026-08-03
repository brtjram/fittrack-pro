// Testbed for the HealthKit sync/aggregation logic in ../healthkit.ts.
//
// There's no real HealthKit in CI or in a plain Jest run, so this mocks
// react-native-health at the JS bridge boundary and feeds it fixture data
// shaped like what the native module actually returns. That lets us pin
// two things a real device test can't easily catch on every change:
//   1. The *contract* healthkit.ts sends to the native module (dates,
//      periods) — this is where the "today always shows 0" bug lived: the
//      native query anchors day-buckets to whatever time-of-day `startDate`
//      carries, so a non-midnight startDate produces buckets that don't
//      line up with real calendar days.
//   2. How healthkit.ts parses and merges whatever native gives back
//      (multi-source dedup, sleep-stage filtering, date bucketing).
//
// Run: npm test --prefix fittrack-mobile

import { Platform } from 'react-native';

const mockHealthKit = {
  Constants: {
    // Real usage is `hk.Constants.Permissions.Steps` etc. — a Proxy that
    // echoes the property name back covers every permission key without
    // hand-listing them.
    Permissions: new Proxy(
      {},
      { get: (_target, prop: string) => prop },
    ),
  },
  isAvailable: jest.fn(),
  initHealthKit: jest.fn(),
  getDailyStepCountSamples: jest.fn(),
  getActiveEnergyBurned: jest.fn(),
  getHeartRateSamples: jest.fn(),
  getSleepSamples: jest.fn(),
  getLatestWeight: jest.fn(),
  getLatestBodyFatPercentage: jest.fn(),
  getLatestHeight: jest.fn(),
};

jest.mock('react-native-health', () => mockHealthKit);

// healthkit.ts pulls in auth-storage.ts (for the last-sync timestamp),
// which pulls in expo-secure-store — a native Expo module shipped as ESM
// that Jest's default transformIgnorePatterns doesn't cover. The testbed
// doesn't care about real token storage, so an in-memory stand-in sidesteps
// that transform entirely rather than widening it for the whole suite.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    setItemAsync: jest.fn(async (key: string, value: string) => { store.set(key, value); }),
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => { store.delete(key); }),
  };
});

import { fetchHealthKitData, syncHealthKitToServer } from '../healthkit';

function localMidnight(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

function localDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

beforeEach(() => {
  (Platform as unknown as { OS: string }).OS = 'ios';
  jest.clearAllMocks();
  // Anything not explicitly configured by a test just reports "no data" —
  // callback(err, empty/null) — rather than leaving the mock uncalled.
  mockHealthKit.getDailyStepCountSamples.mockImplementation((_o, cb) => cb(null, []));
  mockHealthKit.getActiveEnergyBurned.mockImplementation((_o, cb) => cb(null, []));
  mockHealthKit.getHeartRateSamples.mockImplementation((_o, cb) => cb(null, []));
  mockHealthKit.getSleepSamples.mockImplementation((_o, cb) => cb(null, []));
  mockHealthKit.getLatestWeight.mockImplementation((_o, cb) => cb(null, null));
  mockHealthKit.getLatestBodyFatPercentage.mockImplementation((_o, cb) => cb(null, null));
});

describe('fetchHealthKitData — request contract sent to native', () => {
  it('anchors startDate to local midnight, not "now minus N days"', async () => {
    // The regression this guards: react-native-health's period-bucketed
    // query anchors HealthKit's day buckets to `startDate` itself, time of
    // day included — it never zeros the anchor's hour/minute. A startDate
    // left at "now" (e.g. 7:48pm) makes every bucket span 7:48pm-to-7:48pm
    // instead of midnight-to-midnight, and the newest bucket — "today" —
    // starts at the exact instant of the query, so it's always empty.
    await fetchHealthKitData(7);

    for (const fn of [mockHealthKit.getDailyStepCountSamples, mockHealthKit.getActiveEnergyBurned]) {
      expect(fn).toHaveBeenCalledTimes(1);
      const options = fn.mock.calls[0][0];
      const sentStart = new Date(options.startDate);
      expect(sentStart.getHours()).toBe(0);
      expect(sentStart.getMinutes()).toBe(0);
      expect(sentStart.getSeconds()).toBe(0);
      expect(sentStart.getTime()).toBe(localMidnight(7).getTime());
    }
  });

  it('requests 24h buckets, not the native default of hourly', async () => {
    // Without period=24*60, react-native-health defaults to 60 (hourly
    // buckets), and the max-based multi-source dedup below would then keep
    // only the single highest-burning hour of the day instead of the
    // day's total — a real ~180 kcal day reporting as ~40.
    await fetchHealthKitData(7);

    expect(mockHealthKit.getDailyStepCountSamples.mock.calls[0][0].period).toBe(24 * 60);
    expect(mockHealthKit.getActiveEnergyBurned.mock.calls[0][0].period).toBe(24 * 60);
  });
});

describe('fetchHealthKitData — today\'s partial-day bucket', () => {
  it('surfaces a bucket dated today with data through "now", not just completed days', async () => {
    const today = localDateString(new Date());
    mockHealthKit.getDailyStepCountSamples.mockImplementation((_o, cb) =>
      cb(null, [{ startDate: new Date().toISOString(), value: 3482 }]),
    );
    mockHealthKit.getActiveEnergyBurned.mockImplementation((_o, cb) =>
      cb(null, [{ startDate: new Date().toISOString(), value: 351 }]),
    );

    const result = await fetchHealthKitData(7);
    const todayRow = result.find((d) => d.date === today);

    expect(todayRow).toBeDefined();
    expect(todayRow!.steps).toBe(3482);
    expect(todayRow!.activeCalories).toBe(351);
  });
});

describe('fetchHealthKitData — multi-source dedup', () => {
  it('takes the max across sources for the same day, not the sum', async () => {
    // Phone and Watch can both report a same-day cumulative total as a
    // separate row for the same date. Each is already a full-day figure,
    // not a disjoint slice, so summing them double-counts — e.g. a real
    // 7,388-step day would report as 12,912.
    const day = localDateString(localMidnight(1));
    mockHealthKit.getDailyStepCountSamples.mockImplementation((_o, cb) =>
      cb(null, [
        { startDate: localMidnight(1).toISOString(), value: 7388 },
        { startDate: localMidnight(1).toISOString(), value: 7200 }, // Watch's slightly-behind total
      ]),
    );

    const result = await fetchHealthKitData(7);
    expect(result.find((d) => d.date === day)!.steps).toBe(7388);
  });
});

describe('fetchHealthKitData — sleep', () => {
  it('sums only asleep time (excludes INBED and AWAKE) and buckets to the wake-up day', async () => {
    // A 10:45pm-6:15am session (7.5hr in bed) with a 12am-12:10am awake
    // blip and a legacy single-stage ASLEEP sample. Real duration asleep:
    // 7.5hr - 10min awake = 7hr20 = 7.33hr, attributed to the wake day.
    const bedtime = localMidnight(1);
    bedtime.setHours(22, 45, 0, 0);
    const wake = localMidnight(0);
    wake.setHours(6, 15, 0, 0);
    const awakeStart = localMidnight(0);
    awakeStart.setHours(0, 0, 0, 0);
    const awakeEnd = localMidnight(0);
    awakeEnd.setHours(0, 10, 0, 0);
    const wakeDay = localDateString(wake);

    mockHealthKit.getSleepSamples.mockImplementation((_o, cb) =>
      cb(null, [
        { startDate: bedtime.toISOString(), endDate: wake.toISOString(), value: 'INBED' },
        { startDate: bedtime.toISOString(), endDate: awakeStart.toISOString(), value: 'ASLEEP' },
        { startDate: awakeStart.toISOString(), endDate: awakeEnd.toISOString(), value: 'AWAKE' },
        { startDate: awakeEnd.toISOString(), endDate: wake.toISOString(), value: 'ASLEEP' },
      ]),
    );

    const result = await fetchHealthKitData(7);
    const row = result.find((d) => d.date === wakeDay);

    expect(row).toBeDefined();
    expect(row!.sleepHours).toBeCloseTo(7.33, 1);
  });

  it('counts watchOS 9+ sleep stages (CORE/DEEP/REM) as asleep time', async () => {
    const start = localMidnight(0);
    start.setHours(1, 0, 0, 0);
    const end = localMidnight(0);
    end.setHours(4, 0, 0, 0); // 3hr across three 1hr stages
    const day = localDateString(end);

    mockHealthKit.getSleepSamples.mockImplementation((_o, cb) =>
      cb(null, [
        { startDate: start.toISOString(), endDate: new Date(start.getTime() + 3600000).toISOString(), value: 'CORE' },
        { startDate: new Date(start.getTime() + 3600000).toISOString(), endDate: new Date(start.getTime() + 7200000).toISOString(), value: 'DEEP' },
        { startDate: new Date(start.getTime() + 7200000).toISOString(), endDate: end.toISOString(), value: 'REM' },
      ]),
    );

    const result = await fetchHealthKitData(7);
    expect(result.find((d) => d.date === day)!.sleepHours).toBeCloseTo(3, 1);
  });
});

describe('fetchHealthKitData — weight and body fat', () => {
  it('only attaches bodyFatPercent to the day it was actually measured on', async () => {
    const weightDay = localMidnight(0);
    const bodyFatDay = localMidnight(2);

    mockHealthKit.getLatestWeight.mockImplementation((_o, cb) =>
      cb(null, { value: 259.6, startDate: weightDay.toISOString() }),
    );
    mockHealthKit.getLatestBodyFatPercentage.mockImplementation((_o, cb) =>
      cb(null, { value: 24.1, startDate: bodyFatDay.toISOString() }),
    );

    const result = await fetchHealthKitData(7);
    const weightRow = result.find((d) => d.date === localDateString(weightDay));
    const bodyFatRow = result.find((d) => d.date === localDateString(bodyFatDay));

    expect(weightRow!.weight).toBe(259.6);
    expect(weightRow!.bodyFatPercent).toBeNull(); // no body-fat reading *that* day
    expect(bodyFatRow!.bodyFatPercent).toBe(24.1);
  });
});

describe('syncHealthKitToServer', () => {
  it('only syncs weight on days a weight reading exists, and includes sleep/HR only when present', async () => {
    const day = localMidnight(0);
    mockHealthKit.getLatestWeight.mockImplementation((_o, cb) =>
      cb(null, { value: 259.6, startDate: day.toISOString() }),
    );
    mockHealthKit.getDailyStepCountSamples.mockImplementation((_o, cb) =>
      cb(null, [{ startDate: day.toISOString(), value: 5000 }]),
    );

    const syncActivity = jest.fn().mockResolvedValue(undefined);
    const syncWeight = jest.fn().mockResolvedValue(undefined);

    await syncHealthKitToServer(syncActivity, syncWeight, 7);

    const todayCall = syncActivity.mock.calls.find((c) => c[0].date === localDateString(day))![0];
    expect(todayCall.steps).toBe(5000);
    expect(todayCall.restingHeartRate).toBeUndefined();
    expect(todayCall.sleepHours).toBeUndefined();
    expect(syncWeight).toHaveBeenCalledWith(expect.objectContaining({ weightLbs: 259.6 }));
  });

  it('reports hasData: false when Health genuinely returns nothing (permission or empty)', async () => {
    const syncActivity = jest.fn().mockResolvedValue(undefined);
    const syncWeight = jest.fn().mockResolvedValue(undefined);

    const result = await syncHealthKitToServer(syncActivity, syncWeight, 7);

    expect(result.hasData).toBe(false);
  });
});
