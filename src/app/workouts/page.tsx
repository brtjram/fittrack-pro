'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { WorkoutCard } from '@/components/workouts/workout-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Dumbbell, Plus, History, Sparkles, CalendarDays, Check, Trash2, RotateCcw } from 'lucide-react';
import { getRecentWorkouts, saveWorkout, deleteWorkout } from '@/lib/stores/workout-store';
import type { WorkoutSession } from '@/types';
import Link from 'next/link';

export default function WorkoutsPage() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingWeek, setGeneratingWeek] = useState(false);
  const [weekGenerated, setWeekGenerated] = useState(false);
  const [deletedWorkouts, setDeletedWorkouts] = useState<WorkoutSession[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    loadWorkouts();
  }, []);

  const loadWorkouts = async () => {
    try {
      const sessions = await getRecentWorkouts(20);
      setWorkouts(sessions);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWorkout = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/fitness/workouts/generate', { method: 'POST' });
      if (res.status === 400) { router.push('/settings'); return; }
      if (!res.ok) throw new Error('Server error');
      const workout = await res.json();
      router.push(`/workouts/${workout.sessionId}`);
    } catch (err) {
      console.error('Failed to generate workout:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateWeek = async () => {
    setGeneratingWeek(true);
    try {
      const res = await fetch('/api/fitness/workouts/generate-week', { method: 'POST' });
      if (res.status === 400) { router.push('/settings'); return; }
      if (!res.ok) throw new Error('Server error');
      setWeekGenerated(true);
      setTimeout(() => setWeekGenerated(false), 3000);
      loadWorkouts();
    } catch (err) {
      console.error('Failed to generate week plan:', err);
    } finally {
      setGeneratingWeek(false);
    }
  };

  const handleDeleteWorkout = useCallback(async (sessionId: string) => {
    const workout = workouts.find((w) => w.sessionId === sessionId);
    if (!workout) return;

    // Optimistically remove from UI
    setWorkouts((prev) => prev.filter((w) => w.sessionId !== sessionId));
    setDeletedWorkouts((prev) => [...prev, workout]);

    // Actually delete from server
    await deleteWorkout(sessionId);
  }, [workouts]);

  const handleReinstateWorkout = useCallback(async (sessionId: string) => {
    const workout = deletedWorkouts.find((w) => w.sessionId === sessionId);
    if (!workout) return;

    // Re-save to server
    await saveWorkout(workout);

    // Update state
    setDeletedWorkouts((prev) => prev.filter((w) => w.sessionId !== sessionId));
    setWorkouts((prev) => [...prev, workout].sort((a, b) => b.date.localeCompare(a.date)));
  }, [deletedWorkouts]);

  // Find today's incomplete workout
  const today = new Date().toISOString().split('T')[0];
  const todayWorkout = workouts.find((w) => w.date === today && !w.completed);
  const completedWorkouts = workouts.filter((w) => w.completed);
  const upcomingWorkouts = workouts.filter((w) => !w.completed && w.date > today);
  const incompleteWorkouts = workouts.filter((w) => !w.completed && w.date !== today && w.date <= today);

  return (
    <div className="min-h-screen">
      <Header
        title="Workouts"
        action={
          <Link
            href="/workouts/history"
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            <History className="h-4 w-4" />
            History
          </Link>
        }
      />

      <div className="mx-auto max-w-lg space-y-6 p-4">
        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleGenerateWorkout}
            disabled={generating}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-primary transition-colors hover:border-primary/60 hover:bg-primary/10"
          >
            {generating ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span className="text-sm font-semibold">
              {generating ? 'Generating...' : 'Next Workout'}
            </span>
          </button>

          <button
            onClick={handleGenerateWeek}
            disabled={generatingWeek}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 transition-colors ${
              weekGenerated
                ? 'border-success/30 bg-success/5 text-success'
                : 'border-primary/30 bg-primary/5 text-primary hover:border-primary/60 hover:bg-primary/10'
            }`}
          >
            {generatingWeek ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : weekGenerated ? (
              <Check className="h-4 w-4" />
            ) : (
              <CalendarDays className="h-4 w-4" />
            )}
            <span className="text-sm font-semibold">
              {generatingWeek ? 'Planning...' : weekGenerated ? 'Week Planned!' : 'Plan Week'}
            </span>
          </button>
        </div>

        {/* Today's Workout */}
        {todayWorkout && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Today
            </h2>
            <WorkoutCard session={todayWorkout} onDelete={handleDeleteWorkout} />
          </section>
        )}

        {/* Upcoming Workouts */}
        {upcomingWorkouts.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Upcoming
            </h2>
            <div className="space-y-3">
              {upcomingWorkouts.map((session) => (
                <WorkoutCard key={session.sessionId} session={session} onDelete={handleDeleteWorkout} />
              ))}
            </div>
          </section>
        )}

        {/* Incomplete Workouts */}
        {incompleteWorkouts.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              In Progress
            </h2>
            <div className="space-y-3">
              {incompleteWorkouts.map((session) => (
                <WorkoutCard key={session.sessionId} session={session} onDelete={handleDeleteWorkout} />
              ))}
            </div>
          </section>
        )}

        {/* Recent Completed */}
        {completedWorkouts.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Recent
            </h2>
            <div className="space-y-3">
              {completedWorkouts.slice(0, 5).map((session) => (
                <WorkoutCard key={session.sessionId} session={session} onDelete={handleDeleteWorkout} />
              ))}
            </div>
          </section>
        )}

        {/* Deleted Workouts (Reinstate) */}
        {deletedWorkouts.length > 0 && (
          <section>
            <button
              onClick={() => setShowDeleted(!showDeleted)}
              className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Deleted ({deletedWorkouts.length})
              <span className="text-xs normal-case font-normal">
                {showDeleted ? '(hide)' : '(show)'}
              </span>
            </button>
            {showDeleted && (
              <div className="space-y-3">
                {deletedWorkouts.map((session) => (
                  <div
                    key={session.sessionId}
                    className="flex items-center gap-3 rounded-xl border border-border border-dashed bg-card/50 p-4 opacity-60"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm line-through">{session.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' · '}{session.exercises.length} exercises
                      </p>
                    </div>
                    <button
                      onClick={() => handleReinstateWorkout(session.sessionId)}
                      className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reinstate
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Empty State */}
        {!loading && workouts.length === 0 && deletedWorkouts.length === 0 && (
          <EmptyState
            icon={Dumbbell}
            title="No workouts yet"
            description="Generate your first workout plan based on your goals and preferred split. Make sure to set up your profile first!"
            action={
              <button
                onClick={handleGenerateWorkout}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Generate Workout
              </button>
            }
          />
        )}
      </div>
    </div>
  );
}
