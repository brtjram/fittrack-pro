// Covers the "reflect the last known reading, not zero/--" pattern that
// both resolveCurrentWeight and resolveLatestBodyFat implement. The bug
// this guards for body fat specifically: it only ever rides along with a
// weigh-in on days a smart scale actually measured it, so the single most
// recent weight row frequently has no bodyFatPercent even though an
// earlier one does — showing "--" in that case makes a real, still-current
// reading look like it vanished.
import { resolveLatestBodyFat, resolveCurrentWeight } from '@fittrack/core';

describe('resolveLatestBodyFat', () => {
  it('carries forward the last reading that actually had body fat, even if newer rows don\'t', () => {
    const entries = [
      { date: '2026-08-02', bodyFatPercent: null },
      { date: '2026-08-01', bodyFatPercent: 24.1 },
      { date: '2026-07-30', bodyFatPercent: 24.4 },
    ];
    expect(resolveLatestBodyFat(entries)).toBe(24.1);
  });

  it('returns null when no entry has ever recorded body fat', () => {
    const entries = [
      { date: '2026-08-02', bodyFatPercent: null },
      { date: '2026-08-01', bodyFatPercent: undefined },
    ];
    expect(resolveLatestBodyFat(entries)).toBeNull();
  });

  it('is unaffected by input order', () => {
    const entries = [
      { date: '2026-07-30', bodyFatPercent: 24.4 },
      { date: '2026-08-01', bodyFatPercent: 24.1 },
    ];
    expect(resolveLatestBodyFat(entries)).toBe(24.1);
  });
});

describe('resolveCurrentWeight', () => {
  it('uses the latest weigh-in log entry over a stale profile fallback', () => {
    const entries = [{ date: '2026-08-01', weightLbs: 259.6 }];
    expect(resolveCurrentWeight(entries, 265)).toBe(259.6);
  });

  it('falls back to the profile value when no weigh-in log exists yet', () => {
    expect(resolveCurrentWeight([], 265)).toBe(265);
  });
});
