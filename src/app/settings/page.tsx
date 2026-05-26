'use client';

import { useState, useEffect, useRef } from 'react';
import { signOut } from 'next-auth/react';
import { Header } from '@/components/layout/header';
import { Moon, Sun, Monitor, Save, User, LogOut, Check, ExternalLink, Footprints, Info, Flame, ChevronRight } from 'lucide-react';
import { computeStepTarget, stepTargetRationale } from '@/lib/algorithms/step-target';
import { useTheme } from 'next-themes';
import { getUserProfile, saveUserProfile } from '@/lib/stores/user-store';
import type { ActivityLevel, Goal, ExperienceLevel, WorkoutSplit } from '@/types';
import { cn } from '@/lib/utils';
import { NumericInput } from '@/components/shared/numeric-input';

const goalOptions: { value: Goal; label: string; desc: string }[] = [
  { value: 'fat_loss', label: 'Fat Loss', desc: 'Maximize fat loss, preserve muscle' },
  { value: 'muscle_gain', label: 'Muscle Gain', desc: 'Build muscle with lean surplus' },
  { value: 'recomp', label: 'Recomposition', desc: 'Lose fat and gain muscle simultaneously' },
  { value: 'maintain', label: 'Maintain', desc: 'Maintain current weight and performance' },
];

const activityOptions: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Desk job, minimal movement' },
  { value: 'light', label: 'Lightly Active', desc: 'Light exercise 1-3 days/week' },
  { value: 'moderate', label: 'Moderately Active', desc: 'Moderate exercise 3-5 days/week' },
  { value: 'active', label: 'Active', desc: 'Hard exercise 6-7 days/week' },
  { value: 'very_active', label: 'Very Active', desc: 'Intense exercise + physical job' },
];

const experienceOptions: { value: ExperienceLevel; label: string; desc: string }[] = [
  { value: 'beginner', label: 'Beginner', desc: 'Less than 1 year training' },
  { value: 'intermediate', label: 'Intermediate', desc: '1-3 years consistent training' },
  { value: 'advanced', label: 'Advanced', desc: '3+ years serious training' },
];

const splitOptions: { value: WorkoutSplit; label: string; desc: string }[] = [
  { value: 'ppl', label: 'Push/Pull/Legs', desc: '6 days/week, high volume' },
  { value: 'upper_lower', label: 'Upper/Lower', desc: '4 days/week, balanced' },
  { value: 'full_body', label: 'Full Body', desc: '3 days/week, efficient' },
  { value: 'bro_split', label: 'Body Part Split', desc: '5 days/week, classic' },
];

type FormState = {
  name: string;
  age: number;
  gender: 'male' | 'female';
  heightCm: number;
  currentWeightLbs: number;
  targetWeightLbs: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  experienceLevel: ExperienceLevel;
  preferredSplit: WorkoutSplit;
  trackCycle: boolean;
  cycleLength: number;
  lastPeriodDate: string;
};

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const savedFormRef = useRef<string>('');
  const [form, setForm] = useState<FormState>({
    name: '',
    age: 25,
    gender: 'male',
    heightCm: 175,
    currentWeightLbs: 175,
    targetWeightLbs: 165,
    activityLevel: 'moderate',
    goal: 'fat_loss',
    experienceLevel: 'intermediate',
    preferredSplit: 'ppl',
    trackCycle: false,
    cycleLength: 28,
    lastPeriodDate: '',
  });

  useEffect(() => {
    setMounted(true);
    getUserProfile().then((profile) => {
      if (profile) {
        const loaded: FormState = {
          name: profile.name,
          age: profile.age,
          gender: profile.gender,
          heightCm: profile.heightCm,
          currentWeightLbs: profile.currentWeightLbs,
          targetWeightLbs: profile.targetWeightLbs,
          activityLevel: profile.activityLevel,
          goal: profile.goal,
          experienceLevel: profile.experienceLevel,
          preferredSplit: profile.preferredSplit,
          trackCycle: profile.trackCycle ?? false,
          cycleLength: profile.cycleLength ?? 28,
          lastPeriodDate: profile.lastPeriodDate ?? '',
        };
        setForm(loaded);
        savedFormRef.current = JSON.stringify(loaded);
        setSaved(true);
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const existing = await getUserProfile();
      await saveUserProfile({ ...form, id: existing?.id });
      savedFormRef.current = JSON.stringify(form);
      setSaved(true);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      const isDirty = JSON.stringify(next) !== savedFormRef.current;
      setDirty(isDirty);
      if (isDirty) setSaved(false);
      return next;
    });
  };

  const buttonState = saved && !dirty ? 'saved' : saving ? 'saving' : 'save';

  return (
    <div className="min-h-screen">
      <Header
        title="Settings"
        action={
          <button
            onClick={handleSave}
            disabled={saving || (saved && !dirty)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              buttonState === 'saved'
                ? 'bg-success/20 text-success'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {buttonState === 'saved' ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {buttonState === 'saved' ? 'Saved' : buttonState === 'saving' ? 'Saving...' : 'Save'}
          </button>
        }
      />

      <div className="mx-auto max-w-lg space-y-6 p-4">
        {/* Profile Section */}
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Profile</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Age</label>
                <NumericInput
                  value={form.age}
                  onChange={(v) => updateField('age', v)}
                  min={1}
                  placeholder="Age"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Gender</label>
                <div className="flex gap-2">
                  {(['male', 'female'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => updateField('gender', g)}
                      className={cn(
                        'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                        form.gender === g
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-accent'
                      )}
                    >
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Height (cm)</label>
                <NumericInput
                  value={form.heightCm}
                  onChange={(v) => updateField('heightCm', v)}
                  min={1}
                  inputMode="decimal"
                  placeholder="cm"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Weight (lbs)</label>
                <NumericInput
                  value={form.currentWeightLbs}
                  onChange={(v) => updateField('currentWeightLbs', v)}
                  min={1}
                  inputMode="decimal"
                  placeholder="lbs"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted-foreground">Target (lbs)</label>
                <NumericInput
                  value={form.targetWeightLbs}
                  onChange={(v) => updateField('targetWeightLbs', v)}
                  min={1}
                  inputMode="decimal"
                  placeholder="lbs"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Goal */}
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-base font-semibold">Goal</h2>
          <div className="grid grid-cols-2 gap-2">
            {goalOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateField('goal', opt.value)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  form.goal === opt.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-accent'
                )}
              >
                <div className={cn('text-sm font-medium', form.goal === opt.value && 'text-primary')}>
                  {opt.label}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Activity Level */}
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-base font-semibold">Activity Level</h2>
          <div className="space-y-2">
            {activityOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateField('activityLevel', opt.value)}
                className={cn(
                  'w-full rounded-lg border p-3 text-left transition-colors',
                  form.activityLevel === opt.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-accent'
                )}
              >
                <div className={cn('text-sm font-medium', form.activityLevel === opt.value && 'text-primary')}>
                  {opt.label}
                </div>
                <div className="text-xs text-muted-foreground">{opt.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Experience */}
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-base font-semibold">Experience Level</h2>
          <div className="grid grid-cols-3 gap-2">
            {experienceOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateField('experienceLevel', opt.value)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  form.experienceLevel === opt.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-accent'
                )}
              >
                <div className={cn('text-sm font-medium', form.experienceLevel === opt.value && 'text-primary')}>
                  {opt.label}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Workout Split */}
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-base font-semibold">Preferred Split</h2>
          <div className="grid grid-cols-2 gap-2">
            {splitOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateField('preferredSplit', opt.value)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  form.preferredSplit === opt.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-accent'
                )}
              >
                <div className={cn('text-sm font-medium', form.preferredSplit === opt.value && 'text-primary')}>
                  {opt.label}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Step Target — auto-computed from goal + activity */}
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Footprints className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Daily Step Goal</h2>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-primary/5 px-4 py-3">
            <span className="text-2xl font-bold text-primary">
              {computeStepTarget(form.activityLevel, form.goal).toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">steps / day</span>
          </div>
          <div className="mt-2 flex items-start gap-1.5">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {stepTargetRationale(form.activityLevel, form.goal)}. Updates automatically when you change your goal or activity level.
            </p>
          </div>
        </section>

        {/* Menstrual Cycle Tracking — only shown for female gender */}
        {form.gender === 'female' && (
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Cycle Tracking</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Personalizes workout intensity by cycle phase</p>
              </div>
              <button
                onClick={() => updateField('trackCycle', !form.trackCycle)}
                className={cn(
                  'relative h-6 w-11 rounded-full transition-colors',
                  form.trackCycle ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span className={cn(
                  'absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform',
                  form.trackCycle ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            </div>
            {form.trackCycle && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">Cycle Length (days)</label>
                  <NumericInput
                    value={form.cycleLength}
                    onChange={(v) => updateField('cycleLength', v)}
                    min={21}
                    max={35}
                    placeholder="28"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted-foreground">Last Period Start</label>
                  <input
                    type="date"
                    value={form.lastPeriodDate}
                    onChange={(e) => updateField('lastPeriodDate', e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {/* Theme */}
        {mounted && (
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-base font-semibold">Theme</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
                { value: 'system', label: 'System', icon: Monitor },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors',
                    theme === opt.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-accent'
                  )}
                >
                  <opt.icon className={cn('h-5 w-5', theme === opt.value ? 'text-primary' : 'text-muted-foreground')} />
                  <span className={cn('text-sm font-medium', theme === opt.value && 'text-primary')}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Integrations */}
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-base font-semibold">Integrations</h2>
          <div className="space-y-3">
            <IntegrationRow
              name="MyFitnessPal"
              description="Import your food diary and nutrition data"
              exportUrl="https://www.myfitnesspal.com/food/diary"
              instructions="Export your food diary as CSV from MyFitnessPal's website, then import it on the Nutrition page."
            />
            <IntegrationRow
              name="MacroFactor"
              description="Sync macro targets and expenditure data"
              exportUrl="https://help.macrofactorapp.com/exporting_data"
              instructions="Export your data from MacroFactor Settings > Export Data, then use the CSV to set up your macro targets here."
            />
            <IntegrationRow
              name="Apple Health"
              description="Auto-sync steps, calories, and weight"
              href="/settings/health-sync"
              instructions="Set up an iOS Shortcut to automatically push your Apple Health data to FitTrack every night."
            />
          </div>
        </section>

        {/* Data Storage Info */}
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 text-base font-semibold">Data Storage</h2>
          <p className="text-sm text-muted-foreground">
            Your fitness data is stored securely in the cloud, tied to your account. Data persists across all your devices and browsers.
          </p>
        </section>

        {/* Transformation Challenge */}
        <section>
          <a
            href="/challenge"
            className="flex w-full items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 transition-colors hover:bg-red-500/10"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
              <Flame className="h-5 w-5 text-red-500" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">12-Week Transformation Challenge</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Maximum fat loss — steps, food & training tracked weekly</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </a>
        </section>

        {/* Logout */}
        <section>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 py-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </section>

        {/* Legal links */}
        <section className="flex justify-center gap-4 text-xs text-muted-foreground">
          <a href="/terms" target="_blank" className="underline underline-offset-2 hover:text-foreground">Terms of Service</a>
          <a href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</a>
        </section>

        <div className="h-4" />
      </div>
    </div>
  );
}

function IntegrationRow({
  name,
  description,
  exportUrl,
  href,
  instructions,
}: {
  name: string;
  description: string;
  exportUrl?: string;
  href?: string;
  instructions: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border/50 bg-background">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <div>
          <div className="text-sm font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        <span className="text-xs text-muted-foreground">{expanded ? 'Hide' : 'Setup'}</span>
      </button>
      {expanded && (
        <div className="border-t border-border/50 px-3 pb-3 pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">{instructions}</p>
          <div className="mt-2 flex gap-2">
            {exportUrl && (
              <a
                href={exportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
              >
                <ExternalLink className="h-3 w-3" />
                Open {name}
              </a>
            )}
            {href && (
              <a
                href={href}
                className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
              >
                Configure
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
