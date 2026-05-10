'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { NumericInput } from '@/components/shared/numeric-input';
import { WeightChart } from '@/components/analytics/weight-chart';
import { StepsChart } from '@/components/analytics/steps-chart';
import { StrengthChart } from '@/components/analytics/strength-chart';
import { ActivitySummary } from '@/components/analytics/activity-summary';
import { SyncStatus } from '@/components/analytics/sync-status';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Scale, Plus, BarChart3, Dumbbell, Footprints, Flame } from 'lucide-react';
import { getWeightEntries, addWeightEntry } from '@/lib/stores/nutrition-store';
import { getDailyActivities } from '@/lib/stores/analytics-store';
import { getRecentWorkouts } from '@/lib/stores/workout-store';
import { getUserProfile } from '@/lib/stores/user-store';
import { analyzeActivity } from '@/lib/algorithms/activity-analyzer';
import type { WeightEntry, DailyActivity, WorkoutSession } from '@/types';
import { toDateString } from '@/lib/utils';

export default function AnalyticsPage() {
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [targetWeight, setTargetWeight] = useState<number | undefined>();
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'strength' | 'activity'>('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [w, a, s, profile] = await Promise.all([
      getWeightEntries(90),
      getDailyActivities(30),
      getRecentWorkouts(50),
      getUserProfile(),
    ]);
    setWeights(w);
    setActivities(a);
    setWorkouts(s);
    if (profile) setTargetWeight(profile.targetWeightLbs);
  };

  const handleAddWeight = async () => {
    const value = parseFloat(newWeight);
    if (isNaN(value) || value <= 0) return;
    await addWeightEntry({
      date: toDateString(),
      weightLbs: value,
    });
    setNewWeight('');
    setShowWeightInput(false);
    loadData();
  };

  const activityInsight = analyzeActivity(activities);
  const completedWorkouts = workouts.filter((w) => w.completed);
  const thisWeekWorkouts = completedWorkouts.filter((w) => {
    const d = new Date(w.date);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  });

  const latestWeight = weights.length > 0
    ? [...weights].sort((a, b) => b.date.localeCompare(a.date))[0].weightLbs
    : null;

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'strength' as const, label: 'Strength' },
    { id: 'activity' as const, label: 'Activity' },
  ];

  return (
    <div className="min-h-screen">
      <Header
        title="Analytics"
        action={
          <button
            onClick={() => setShowWeightInput(!showWeightInput)}
            className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20"
          >
            <Scale className="h-4 w-4" />
            Log Weight
          </button>
        }
      />

      <div className="mx-auto max-w-lg space-y-6 p-4">
        {/* Weight Input */}
        {showWeightInput && (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <NumericInput
              value={Number(newWeight) || 0}
              onChange={(v) => setNewWeight(String(v || ''))}
              min={1}
              inputMode="decimal"
              placeholder="Weight in lbs"
              allowEmpty
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={handleAddWeight}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Save
            </button>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            label="Weight"
            value={latestWeight ? `${latestWeight} lbs` : '--'}
            icon={Scale}
          />
          <StatCard
            label="This Week"
            value={thisWeekWorkouts.length}
            subtitle="workouts"
            icon={Dumbbell}
          />
          <StatCard
            label="Avg Steps"
            value={activityInsight.averageSteps > 0 ? `${(activityInsight.averageSteps / 1000).toFixed(1)}k` : '--'}
            icon={Footprints}
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <>
            <WeightChart entries={weights} targetWeight={targetWeight} />
            {activities.length > 0 && <ActivitySummary insight={activityInsight} />}
            <SyncStatus />
          </>
        )}

        {activeTab === 'strength' && (
          <>
            <StrengthChart sessions={workouts} />
            {completedWorkouts.length === 0 && (
              <EmptyState
                icon={Dumbbell}
                title="No workout data"
                description="Complete workouts to see your strength progress over time."
              />
            )}
          </>
        )}

        {activeTab === 'activity' && (
          <>
            <StepsChart activities={activities} />
            <ActivitySummary insight={activityInsight} />
            <SyncStatus />
            {activities.length === 0 && (
              <EmptyState
                icon={Footprints}
                title="No activity data"
                description="Set up Apple Health sync or manually log your daily steps and activity."
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
