'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Dumbbell, UtensilsCrossed, BarChart3,
  Scale, Sparkles, ArrowRight, Target,
  Flame, Trophy, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { getUserProfile } from '@/lib/stores/user-store';
import { getRecentWorkouts } from '@/lib/stores/workout-store';
import { getFoodLogByDate, getWeightEntries } from '@/lib/stores/nutrition-store';
import { getDailyActivities } from '@/lib/stores/analytics-store';
import { calculateMacroTargets, calculateAdaptiveAdjustment } from '@/lib/algorithms/macro-calculator';
import { analyzeActivity, shouldSuggestRestDay } from '@/lib/algorithms/activity-analyzer';
import type { UserProfile, WorkoutSession } from '@/types';
import { toDateString } from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [todayCalories, setTodayCalories] = useState({ eaten: 0, target: 0 });
  const [todayProtein, setTodayProtein] = useState({ eaten: 0, target: 0 });
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [p, w, weights, activities] = await Promise.all([
        getUserProfile(),
        getRecentWorkouts(20),
        getWeightEntries(30),
        getDailyActivities(14),
      ]);

      setProfile(p ?? null);
      setWorkouts(w);

      if (p) {
        const macros = calculateMacroTargets(p);
        const todayLog = await getFoodLogByDate(toDateString());
        const eaten = todayLog.reduce((acc, e) => ({
          calories: acc.calories + e.calories,
          protein: acc.protein + e.protein,
        }), { calories: 0, protein: 0 });

        setTodayCalories({ eaten: eaten.calories, target: macros.calories });
        setTodayProtein({ eaten: eaten.protein, target: macros.protein });

        const insightsList: string[] = [];
        const activityInsight = analyzeActivity(activities);

        if (weights.length > 0) {
          const sorted = [...weights].sort((a, b) => b.date.localeCompare(a.date));
          setLatestWeight(sorted[0].weightLbs);

          const adj = calculateAdaptiveAdjustment(macros.calories, weights, p.goal);
          if (adj.shouldAdjust) {
            insightsList.push(adj.reason);
          }
        }

        if (activityInsight.averageSteps > 0 && activityInsight.category === 'sedentary') {
          insightsList.push('Your step count is low. Try a 15-minute walk after meals to boost daily movement.');
        }

        const completedThisWeek = w.filter((s) => {
          const d = new Date(s.date);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return s.completed && d >= weekAgo;
        });

        const restSuggestion = shouldSuggestRestDay(activities, completedThisWeek.length);
        if (restSuggestion.suggest) {
          insightsList.push(restSuggestion.reason);
        }

        if (eaten.protein < macros.protein * 0.5 && new Date().getHours() >= 14) {
          insightsList.push(`You've only had ${Math.round(eaten.protein)}g protein so far. You need ${Math.round(macros.protein - eaten.protein)}g more today.`);
        }

        setInsights(insightsList);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartWorkout = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/fitness/workouts/generate', { method: 'POST' });
      if (res.status === 400) {
        router.push('/settings');
        return;
      }
      if (!res.ok) throw new Error('Server error');
      const workout = await res.json();
      router.push(`/workouts/${workout.sessionId}`);
    } catch (err) {
      console.error('Failed to generate workout:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/test/seed', { method: 'POST' });
      if (res.ok) await loadDashboard();
    } finally {
      setSeeding(false);
    }
  };

  if (!loading && !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="rounded-2xl bg-primary/10 p-6">
          <Dumbbell className="mx-auto h-16 w-16 text-primary" />
        </div>
        <h1 className="mt-6 text-2xl font-bold">Welcome to FitTrack Pro</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">
          Your expert workout planner, smart nutrition tracker, and analytics dashboard.
        </p>
        <Link
          href="/settings"
          className="mt-8 flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Set Up Your Profile
          <ArrowRight className="h-4 w-4" />
        </Link>
        <button
          onClick={handleSeedData}
          disabled={seeding}
          className="mt-3 flex items-center gap-2 rounded-xl border border-border px-8 py-3 text-sm font-semibold text-muted-foreground hover:bg-accent disabled:opacity-50"
        >
          {seeding ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {seeding ? 'Loading test data…' : 'Load Test Data'}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const todayWorkout = workouts.find((w) => w.date === toDateString() && !w.completed);
  const todayCompleted = !todayWorkout && workouts.some((w) => w.date === toDateString() && w.completed);
  const completedThisWeek = workouts.filter((w) => {
    const d = new Date(w.date);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return w.completed && d >= weekAgo;
  }).length;

  const caloriePercent = todayCalories.target > 0
    ? Math.round((todayCalories.eaten / todayCalories.target) * 100)
    : 0;

  return (
    <div className="min-h-screen">
      <div className="bg-gradient-to-b from-primary/10 to-background px-4 pb-6 pt-8">
        <div className="mx-auto max-w-lg">
          <h1 className="text-2xl font-bold">
            {getGreeting()}, {profile?.name || 'there'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile?.goal === 'fat_loss' && 'Staying lean and strong.'}
            {profile?.goal === 'muscle_gain' && 'Building muscle, one rep at a time.'}
            {profile?.goal === 'recomp' && 'Transforming your body composition.'}
            {profile?.goal === 'maintain' && 'Maintaining your progress.'}
            {profile?.goal === 'ai_coach' && (profile.aiCoachGoal || 'AI Coach Mode — ask your coach to set your plan.')}
            {profile?.goal === 'challenge' && '12-Week Transformation — maximum fat loss, phase by phase.'}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-6 px-4 pb-6">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Calories Today"
            value={`${Math.round(todayCalories.eaten)} / ${Math.round(todayCalories.target)}`}
            icon={Flame}
            className={caloriePercent > 100 ? 'border-destructive/30' : ''}
          />
          <StatCard
            label="Protein"
            value={`${Math.round(todayProtein.eaten)}g / ${Math.round(todayProtein.target)}g`}
            icon={Target}
          />
          <StatCard
            label="Weight"
            value={latestWeight ? `${latestWeight} lbs` : '--'}
            icon={Scale}
          />
          <StatCard
            label="Workouts / Week"
            value={completedThisWeek}
            icon={Dumbbell}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          {todayWorkout ? (
            <Link href={`/workouts/${todayWorkout.sessionId}`} className="block">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-primary uppercase">Continue Workout</p>
                  <h3 className="mt-1 text-lg font-bold">{todayWorkout.name}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {todayWorkout.exercises.filter((e) => e.sets.every((s) => s.completed)).length}/{todayWorkout.exercises.length} exercises done
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-primary" />
              </div>
            </Link>
          ) : todayCompleted ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-success uppercase">Workout Complete</p>
                <h3 className="mt-1 text-lg font-bold">Great work today! 💪</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">Rest up and come back tomorrow.</p>
              </div>
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
          ) : (
            <button
              onClick={handleStartWorkout}
              disabled={generating}
              className="flex w-full items-center justify-between"
            >
              <div className="text-left">
                <p className="text-xs font-medium text-muted-foreground uppercase">Ready to train?</p>
                <h3 className="mt-1 text-lg font-bold">Start Today&apos;s Workout</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  AI-generated plan based on your split
                </p>
              </div>
              {generating ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <Sparkles className="h-5 w-5 text-primary" />
              )}
            </button>
          )}
        </div>

        {insights.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Smart Insights
            </h2>
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-card p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-sm text-muted-foreground">{insight}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Link
            href="/nutrition"
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent"
          >
            <UtensilsCrossed className="h-6 w-6 text-primary" />
            <span className="text-xs font-medium">Log Food</span>
          </Link>
          <Link
            href="/analytics"
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent"
          >
            <BarChart3 className="h-6 w-6 text-primary" />
            <span className="text-xs font-medium">Analytics</span>
          </Link>
          <Link
            href="/nutrition/supplements"
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent"
          >
            <Trophy className="h-6 w-6 text-primary" />
            <span className="text-xs font-medium">Supplements</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
