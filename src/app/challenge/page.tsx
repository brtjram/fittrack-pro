'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Flame, Trophy, Target, Footprints, Dumbbell, Utensils, X, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeeklyCheckIn {
  week: number;
  endWeight?: number;
  avgDailySteps?: number;
  workoutsCompleted?: number;
  workoutsTargeted?: number;
  foodComplianceDays?: number;
  notes?: string;
}

interface Challenge {
  id: string;
  startDate: string;
  startWeightLbs: number;
  targetWeightLbs: number;
  currentWeek: number;
  isActive: boolean;
  weeklyData: WeeklyCheckIn[];
}

const PHASE_INFO = [
  {
    phase: 1, weeks: '1–4', label: 'Foundation',
    desc: 'Establish habits. Moderate deficit (~300 cal). Build workout consistency. Hit your step target every day.',
    color: 'blue',
    bgClass: 'bg-blue-500/10 border-blue-500/30',
    textClass: 'text-blue-500',
    barClass: 'bg-blue-500',
    targets: { steps: 9000, calories: 300, workoutsPerWeek: 4, complianceDays: 5 },
  },
  {
    phase: 2, weeks: '5–8', label: 'Acceleration',
    desc: 'Tighten the diet (~400 cal deficit). Increase NEAT. Bump training intensity. Weekly weigh-ins are critical.',
    color: 'amber',
    bgClass: 'bg-amber-500/10 border-amber-500/30',
    textClass: 'text-amber-500',
    barClass: 'bg-amber-500',
    targets: { steps: 11000, calories: 400, workoutsPerWeek: 5, complianceDays: 6 },
  },
  {
    phase: 3, weeks: '9–12', label: 'Peak',
    desc: 'Aggressive deficit (~500 cal). Maximum intensity. Preserve muscle with heavy compounds. Push through the finish line.',
    color: 'red',
    bgClass: 'bg-red-500/10 border-red-500/30',
    textClass: 'text-red-500',
    barClass: 'bg-red-500',
    targets: { steps: 12000, calories: 500, workoutsPerWeek: 5, complianceDays: 6 },
  },
];

function getPhaseInfo(week: number) {
  if (week <= 4) return PHASE_INFO[0];
  if (week <= 8) return PHASE_INFO[1];
  return PHASE_INFO[2];
}

function getWeekTargets(week: number, startWeight: number, targetWeight: number) {
  const phase = getPhaseInfo(week);
  const totalLoss = startWeight - targetWeight;
  const weeklyLoss = totalLoss / 12;
  const expectedWeight = Math.round((startWeight - weeklyLoss * (week - 1)) * 10) / 10;
  return { ...phase.targets, expectedWeight };
}

export default function ChallengePage() {
  const [challenge, setChallenge] = useState<Challenge | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkIn, setCheckIn] = useState<WeeklyCheckIn>({ week: 1 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fitness/transformation-challenge');
      if (res.ok) {
        const data = await res.json();
        setChallenge(data);
        if (data) setCheckIn({ week: data.currentWeek });
      } else {
        setChallenge(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startChallenge = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/fitness/transformation-challenge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (res.ok) {
        const data = await res.json();
        setChallenge(data);
        setCheckIn({ week: data.currentWeek });
      }
    } finally {
      setSaving(false);
    }
  };

  const endChallenge = async () => {
    if (!confirm('Are you sure you want to end the transformation challenge?')) return;
    await fetch('/api/fitness/transformation-challenge', { method: 'DELETE' });
    setChallenge(null);
  };

  const submitCheckIn = async () => {
    if (!challenge) return;
    setSaving(true);
    try {
      const nextWeek = Math.min(challenge.currentWeek + 1, 12);
      const res = await fetch('/api/fitness/transformation-challenge', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentWeek: nextWeek, weeklyCheckIn: checkIn }),
      });
      if (res.ok) {
        const data = await res.json();
        setChallenge(data);
        setShowCheckIn(false);
        setCheckIn({ week: nextWeek });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading || challenge === undefined) {
    return (
      <div className="min-h-screen">
        <Header title="Transformation Challenge" />
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!challenge || !challenge.isActive) {
    return (
      <div className="min-h-screen">
        <Header title="12-Week Transformation" />
        <div className="mx-auto max-w-lg space-y-6 p-4">
          {/* Hero */}
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
              <Flame className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-extrabold">12-Week Transformation</h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              A structured body transformation program to maximize fat loss while preserving muscle.
              Close tracking of steps, food, and training with adjustments every 4 weeks.
            </p>
          </div>

          {/* Phases */}
          <div className="space-y-3">
            {PHASE_INFO.map((p) => (
              <div key={p.phase} className={cn('rounded-xl border p-4', p.bgClass)}>
                <div className={cn('text-xs font-bold uppercase tracking-wide', p.textClass)}>
                  Phase {p.phase} — Weeks {p.weeks}
                </div>
                <div className="mt-1 text-base font-bold">{p.label}</div>
                <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <span className={cn('flex items-center gap-1 text-xs font-medium', p.textClass)}>
                    <Footprints className="h-3 w-3" /> {p.targets.steps.toLocaleString()} steps/day
                  </span>
                  <span className={cn('flex items-center gap-1 text-xs font-medium', p.textClass)}>
                    <Dumbbell className="h-3 w-3" /> {p.targets.workoutsPerWeek} workouts/week
                  </span>
                  <span className={cn('flex items-center gap-1 text-xs font-medium', p.textClass)}>
                    <Utensils className="h-3 w-3" /> {p.targets.complianceDays}/7 on-plan days
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={startChallenge}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-4 text-base font-bold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            <Flame className="h-5 w-5" />
            {saving ? 'Starting...' : 'Start Transformation Challenge'}
          </button>
        </div>
      </div>
    );
  }

  const phase = getPhaseInfo(challenge.currentWeek);
  const targets = getWeekTargets(challenge.currentWeek, challenge.startWeightLbs, challenge.targetWeightLbs);
  const progressPct = Math.min(((challenge.currentWeek - 1) / 12) * 100, 100);
  const lastCheckIn = challenge.weeklyData[challenge.weeklyData.length - 1] as WeeklyCheckIn | undefined;
  const actualLoss = lastCheckIn?.endWeight ? challenge.startWeightLbs - lastCheckIn.endWeight : 0;
  const totalLoss = challenge.startWeightLbs - challenge.targetWeightLbs;

  return (
    <div className="min-h-screen">
      <Header title="Transformation Challenge" />
      <div className="mx-auto max-w-lg space-y-5 p-4">
        {/* Header card */}
        <div className={cn('rounded-xl border p-4', phase.bgClass)}>
          <div className="flex items-center gap-3">
            <Flame className={cn('h-6 w-6', phase.textClass)} />
            <div className="flex-1">
              <div className="text-lg font-extrabold">Week {challenge.currentWeek} of 12</div>
              <div className={cn('text-sm font-semibold', phase.textClass)}>Phase {phase.phase}: {phase.label}</div>
            </div>
            <button onClick={endChallenge} className="rounded-lg p-1.5 hover:bg-background/50">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="mt-3 h-2 rounded-full bg-background/40">
            <div
              className={cn('h-2 rounded-full transition-all', phase.barClass)}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{challenge.currentWeek - 1} of 12 weeks complete</div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Start', value: `${challenge.startWeightLbs}lbs` },
            { label: 'Lost', value: actualLoss > 0 ? `-${actualLoss.toFixed(1)}lbs` : '—', highlight: true },
            { label: 'Target', value: `${challenge.targetWeightLbs}lbs` },
            { label: 'To Go', value: `${Math.max(0, totalLoss - actualLoss).toFixed(1)}lbs` },
          ].map((s) => (
            <div key={s.label} className={cn('rounded-xl border p-3 text-center', s.highlight ? 'border-primary/30 bg-primary/10' : 'border-border bg-card')}>
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className={cn('mt-1 text-sm font-bold', s.highlight && 'text-primary')}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* This phase */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold">This Phase</h3>
          <p className="mt-1 text-sm text-muted-foreground">{phase.desc}</p>
        </div>

        {/* Week targets */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 font-semibold">Week {challenge.currentWeek} Targets</h3>
          <div className="space-y-2">
            {[
              { icon: Footprints, label: 'Daily Steps', value: `${targets.steps.toLocaleString()}+` },
              { icon: Dumbbell, label: 'Workouts', value: `${targets.workoutsPerWeek}/week` },
              { icon: Utensils, label: 'On-Plan Days', value: `${targets.complianceDays}/7` },
              { icon: Target, label: 'Target Weight', value: `~${targets.expectedWeight}lbs` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4', phase.textClass)} />
                  <span className="text-sm">{label}</span>
                </div>
                <span className="text-sm font-semibold">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Progress log */}
        {challenge.weeklyData.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 font-semibold">Progress Log</h3>
            <div className="space-y-1">
              {challenge.weeklyData.map((w) => (
                <div key={w.week} className="grid grid-cols-4 gap-2 rounded-lg px-2 py-1.5 text-xs odd:bg-muted/30">
                  <span className="font-medium text-muted-foreground">Wk {w.week}</span>
                  <span className="font-semibold">{w.endWeight ? `${w.endWeight}lbs` : '—'}</span>
                  <span className="text-muted-foreground">{w.avgDailySteps ? `${(w.avgDailySteps / 1000).toFixed(1)}k steps` : ''}</span>
                  <span className="text-muted-foreground">{w.workoutsCompleted !== undefined ? `${w.workoutsCompleted}/${w.workoutsTargeted ?? '?'} wkts` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Check-in */}
        {showCheckIn ? (
          <div className={cn('rounded-xl border-2 p-4', phase.bgClass)}>
            <h3 className="mb-4 font-semibold">Week {challenge.currentWeek} Check-In</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weight this morning (lbs)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 183.5"
                  value={checkIn.endWeight ?? ''}
                  onChange={(e) => setCheckIn((c) => ({ ...c, endWeight: parseFloat(e.target.value) || undefined }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avg daily steps</label>
                <input
                  type="number"
                  placeholder="e.g. 9500"
                  value={checkIn.avgDailySteps ?? ''}
                  onChange={(e) => setCheckIn((c) => ({ ...c, avgDailySteps: parseInt(e.target.value) || undefined }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workouts done</label>
                  <input
                    type="number"
                    placeholder="e.g. 4"
                    value={checkIn.workoutsCompleted ?? ''}
                    onChange={(e) => setCheckIn((c) => ({ ...c, workoutsCompleted: parseInt(e.target.value) || undefined }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">On-plan food days</label>
                  <input
                    type="number"
                    max={7}
                    placeholder="e.g. 5"
                    value={checkIn.foodComplianceDays ?? ''}
                    onChange={(e) => setCheckIn((c) => ({ ...c, foodComplianceDays: parseInt(e.target.value) || undefined }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</label>
                <textarea
                  rows={2}
                  placeholder="How did this week feel?"
                  value={checkIn.notes ?? ''}
                  onChange={(e) => setCheckIn((c) => ({ ...c, notes: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCheckIn(false)}
                  className="flex-1 rounded-lg border border-border py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={submitCheckIn}
                  disabled={saving}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save & Advance'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCheckIn(true)}
            className={cn('flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold text-white transition-colors', phase.barClass, 'hover:opacity-90')}
          >
            <Trophy className="h-5 w-5" />
            Week {challenge.currentWeek} Check-In
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
