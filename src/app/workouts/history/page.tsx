'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { WorkoutCard } from '@/components/workouts/workout-card';
import { EmptyState } from '@/components/shared/empty-state';
import { History } from 'lucide-react';
import { getRecentWorkouts } from '@/lib/stores/workout-store';
import { parseDateOnly, toDateString, formatDateShort } from '@/lib/utils';
import type { WorkoutSession } from '@/types';

export default function WorkoutHistoryPage() {
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecentWorkouts(50).then((sessions) => {
      setWorkouts(sessions.filter((s) => s.completed));
      setLoading(false);
    });
  }, []);

  // Group by week
  const groupedByWeek = workouts.reduce<Record<string, WorkoutSession[]>>((acc, session) => {
    const date = parseDateOnly(session.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const key = toDateString(weekStart);
    if (!acc[key]) acc[key] = [];
    acc[key].push(session);
    return acc;
  }, {});

  return (
    <div className="min-h-screen">
      <Header title="Workout History" showBack />

      <div className="mx-auto max-w-lg space-y-6 p-4">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {!loading && workouts.length === 0 && (
          <EmptyState
            icon={History}
            title="No workout history"
            description="Complete your first workout to see it here."
          />
        )}

        {Object.entries(groupedByWeek).map(([weekStart, sessions]) => (
          <section key={weekStart}>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Week of {formatDateShort(weekStart)}
            </h2>
            <div className="space-y-3">
              {sessions.map((session) => (
                <WorkoutCard key={session.sessionId} session={session} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
