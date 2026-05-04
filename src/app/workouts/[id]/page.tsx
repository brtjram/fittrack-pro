'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { ExerciseItem } from '@/components/workouts/exercise-item';
import { Timer, CheckCircle2, Clock, Footprints, Dumbbell, Flame } from 'lucide-react';
import { getWorkoutById, saveWorkout, savePersonalRecord, getPersonalRecords } from '@/lib/stores/workout-store';
import { checkPersonalRecord } from '@/lib/algorithms/progressive-overload';
import type { WorkoutSession, WorkoutSet, PersonalRecord } from '@/types';
import { cn } from '@/lib/utils';

const CARDIO_TYPES = ['Walking', 'Running', 'Cycling', 'Elliptical', 'Rowing', 'Other'];

function getRatingLabel(r: number): string {
  if (r <= 7) return "Nice grind! We'll push the intensity next session.";
  if (r <= 9) return 'Solid effort! Keeping this intensity next session.';
  return "Beast mode! We'll ease up a touch next session to avoid overtraining.";
}

function getRatingColor(r: number): string {
  if (r <= 7) return 'bg-blue-500 text-white';
  if (r <= 9) return 'bg-success text-white';
  return 'bg-orange-500 text-white';
}

export default function WorkoutSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [restTarget, setRestTarget] = useState(0);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Post-workout state
  const [phase, setPhase] = useState<'workout' | 'rating' | 'done'>('workout');
  const [rating, setRating] = useState<number | null>(null);
  const [cardioType, setCardioType] = useState('');
  const [cardioDuration, setCardioDuration] = useState('');
  const [savingRating, setSavingRating] = useState(false);

  // Step tracking
  const [todaySteps, setTodaySteps] = useState<number | null>(null);
  const [stepTarget, setStepTarget] = useState(10000);

  useEffect(() => {
    loadSession();
    loadPRs();
    loadActivityAndProfile();
  }, [id]);

  // Elapsed time counter
  useEffect(() => {
    if (phase !== 'workout') return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, phase]);

  // Rest timer countdown
  useEffect(() => {
    if (restTimer <= 0) return;
    const interval = setInterval(() => {
      setRestTimer((t) => (t <= 1 ? 0 : t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [restTimer]);

  const loadSession = async () => {
    const s = await getWorkoutById(id);
    if (s?.completed) setPhase('done');
    setSession(s ?? null);
    setLoading(false);
  };

  const loadPRs = async () => {
    setPrs(await getPersonalRecords());
  };

  const loadActivityAndProfile = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [actRes, profRes] = await Promise.all([
        fetch(`/api/fitness/activities?date=${today}`),
        fetch('/api/fitness/profile'),
      ]);
      if (actRes.ok) {
        const act = await actRes.json();
        if (act) setTodaySteps(act.steps ?? 0);
      }
      if (profRes.ok) {
        const prof = await profRes.json();
        if (prof?.stepTarget) setStepTarget(prof.stepTarget);
      }
    } catch {
      // non-critical
    }
  };

  const handleUpdateSets = useCallback(async (exerciseIndex: number, sets: WorkoutSet[]) => {
    if (!session) return;

    const updatedSession = { ...session };
    updatedSession.exercises = [...session.exercises];
    updatedSession.exercises[exerciseIndex] = { ...session.exercises[exerciseIndex], sets };

    const exercise = updatedSession.exercises[exerciseIndex];
    const justCompleted = sets.find(
      (s, i) => s.completed && !session.exercises[exerciseIndex].sets[i]?.completed
    );
    if (justCompleted) {
      setRestTarget(exercise.restSeconds);
      setRestTimer(exercise.restSeconds);

      if (justCompleted.actualWeight && justCompleted.actualReps) {
        const isPR = checkPersonalRecord(exercise.exerciseId, justCompleted.actualWeight, justCompleted.actualReps, prs);
        if (isPR) {
          await savePersonalRecord({
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            weight: justCompleted.actualWeight,
            reps: justCompleted.actualReps,
            date: session.date,
            sessionId: session.sessionId,
          });
          loadPRs();
        }
      }
    }

    setSession(updatedSession);
    await saveWorkout(updatedSession);
  }, [session, prs]);

  const handleFinish = async () => {
    if (!session) return;
    const duration = Math.round(elapsed / 60);
    const completed = { ...session, completed: true, duration };
    setSession(completed);
    await saveWorkout(completed);
    setPhase('rating');
  };

  const handleSaveRating = async () => {
    if (!session || rating === null) return;
    setSavingRating(true);
    try {
      const cardioLog = cardioType && cardioDuration
        ? JSON.stringify({ type: cardioType, durationMin: parseInt(cardioDuration) })
        : undefined;

      const updated = { ...session, rating, ...(cardioLog ? { cardioLog } : {}) };
      setSession(updated);
      await saveWorkout(updated);

      // If cardio was logged, update DailyActivity with estimated steps/calories
      if (cardioType && cardioDuration) {
        const mins = parseInt(cardioDuration) || 0;
        const today = new Date().toISOString().split('T')[0];
        const stepsFromCardio = cardioType === 'Running' ? mins * 160 : cardioType === 'Walking' ? mins * 100 : mins * 80;
        const cals = cardioType === 'Running' ? mins * 10 : cardioType === 'Cycling' ? mins * 8 : mins * 7;
        await fetch('/api/fitness/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: today,
            steps: (todaySteps ?? 0) + stepsFromCardio,
            activeCalories: cals,
            source: 'manual',
          }),
        });
        setTodaySteps((s) => (s ?? 0) + stepsFromCardio);
      }

      setPhase('done');
    } finally {
      setSavingRating(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen">
        <Header title="Workout Not Found" showBack />
        <div className="p-8 text-center text-muted-foreground">This workout session could not be found.</div>
      </div>
    );
  }

  const allCompleted = session.exercises.every((e) => e.sets.every((s) => s.completed));
  const stepPct = todaySteps !== null ? Math.min(100, Math.round((todaySteps / stepTarget) * 100)) : null;

  // ── Rating phase ────────────────────────────────────────────────────────────
  if (phase === 'rating') {
    return (
      <div className="min-h-screen">
        <Header title="Rate Your Workout" />
        <div className="mx-auto max-w-lg space-y-6 p-4">
          {/* Duration recap */}
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <p className="mt-2 font-semibold">{session.name}</p>
            <p className="text-sm text-muted-foreground">Duration: {session.duration} min</p>
          </div>

          {/* Steps recap */}
          {stepPct !== null && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Footprints className="h-4 w-4 text-primary" />
                  Today's Steps
                </div>
                <span className="text-sm font-semibold">{todaySteps?.toLocaleString()} / {stepTarget.toLocaleString()}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${stepPct}%` }} />
              </div>
              {todaySteps !== null && todaySteps < stepTarget && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {(stepTarget - todaySteps).toLocaleString()} more steps to hit your daily goal.
                </p>
              )}
            </div>
          )}

          {/* Cardio logging */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Flame className="h-4 w-4 text-orange-500" />
              Log Cardio (optional)
            </div>
            <div className="grid grid-cols-3 gap-2">
              {CARDIO_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setCardioType((prev) => (prev === t ? '' : t))}
                  className={cn(
                    'rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
                    cardioType === t
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            {cardioType && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={cardioDuration}
                  onChange={(e) => setCardioDuration(e.target.value.replace(/\D/g, ''))}
                  placeholder="Duration (min)"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
          </div>

          {/* Rating */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Dumbbell className="h-4 w-4 text-primary" />
              How hard was this session?
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  className={cn(
                    'rounded-xl py-3 text-sm font-bold transition-colors',
                    rating === n
                      ? getRatingColor(n)
                      : 'bg-muted text-foreground hover:bg-accent'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            {rating !== null && (
              <p className="text-center text-xs text-muted-foreground">{getRatingLabel(rating)}</p>
            )}
          </div>

          <button
            onClick={handleSaveRating}
            disabled={rating === null || savingRating}
            className="w-full rounded-xl bg-primary py-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {savingRating ? 'Saving…' : 'Save & Finish'}
          </button>
          <button
            onClick={() => setPhase('done')}
            className="w-full py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Skip rating
          </button>
        </div>
      </div>
    );
  }

  // ── Done phase ───────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <div className="min-h-screen">
        <Header title="Workout Complete" />
        <div className="mx-auto max-w-lg space-y-4 p-4">
          <div className="rounded-xl bg-success/10 border border-success/20 p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <h3 className="mt-3 text-lg font-bold">Great Work!</h3>
            <p className="mt-1 text-sm text-muted-foreground">{session.name} — {session.duration} min</p>
            {session.rating !== undefined && session.rating !== null && (
              <div className={cn('mt-3 inline-block rounded-full px-4 py-1 text-sm font-semibold', getRatingColor(session.rating))}>
                Rated {session.rating}/10
              </div>
            )}
            {session.cardioLog && (() => {
              try {
                const c = JSON.parse(session.cardioLog);
                return <p className="mt-2 text-xs text-muted-foreground">{c.type} · {c.durationMin} min cardio logged</p>;
              } catch { return null; }
            })()}
          </div>

          {stepPct !== null && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Footprints className="h-4 w-4 text-primary" />
                  Today's Steps
                </div>
                <span className="text-sm font-semibold">{todaySteps?.toLocaleString()} / {stepTarget.toLocaleString()}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${stepPct}%` }} />
              </div>
            </div>
          )}

          <button
            onClick={() => router.push('/workouts')}
            className="w-full rounded-xl bg-primary py-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Back to Workouts
          </button>
        </div>
      </div>
    );
  }

  // ── Workout phase ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">
      <Header
        title={session.name}
        showBack
        action={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {formatTime(elapsed)}
          </div>
        }
      />

      {/* Rest Timer Overlay */}
      {restTimer > 0 && (
        <div className="sticky top-14 z-30 border-b border-border bg-primary/10 px-4 py-3">
          <div className="mx-auto flex max-w-lg items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Rest Timer</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-primary">{formatTime(restTimer)}</span>
              <button
                onClick={() => setRestTimer(0)}
                className="rounded-lg bg-primary/20 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/30"
              >
                Skip
              </button>
            </div>
          </div>
          <div className="mx-auto mt-2 max-w-lg">
            <div className="h-1.5 rounded-full bg-primary/20">
              <div
                className="h-full rounded-full bg-primary transition-all duration-1000"
                style={{ width: `${restTarget > 0 ? (restTimer / restTarget) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-lg space-y-4 p-4">
        {session.isDeload && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm text-primary">
            <strong>Deload Week</strong> — Reduced volume and weight for recovery.
          </div>
        )}

        {/* Step progress bar */}
        {stepPct !== null && (
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <Footprints className="h-3.5 w-3.5" />
                Today's Steps
              </div>
              <span className="font-semibold">{todaySteps?.toLocaleString()} / {stepTarget.toLocaleString()}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${stepPct}%` }} />
            </div>
          </div>
        )}

        {session.exercises.map((exercise, i) => (
          <ExerciseItem
            key={exercise.exerciseId + i}
            exercise={exercise}
            onUpdateSets={(sets) => handleUpdateSets(i, sets)}
          />
        ))}

        {/* Finish Workout */}
        <button
          onClick={handleFinish}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-semibold transition-colors',
            allCompleted
              ? 'bg-success text-white hover:bg-success/90'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          )}
        >
          <CheckCircle2 className="h-5 w-5" />
          {allCompleted ? 'Finish Workout' : 'Finish Early'}
        </button>
      </div>
    </div>
  );
}
