import { prisma } from '@/lib/prisma';
import { generateNextWorkout, type CoachingNotes } from '@/lib/algorithms/workout-generator';
import { getWorkoutPlan } from '@/lib/data/workout-templates';
import { parseExercises, generateId, getWeekNumber } from '@/lib/utils';
import { toCalcUserProfile, type FitnessProfileRow } from './fitness-profile-adapter';
import type { WorkoutSession } from '@/types';

export interface CardioSessionInput {
  /** 0 = Sunday of the current week, 6 = Saturday. */
  dayOffset: number;
  name: string;
  durationMinutes?: number;
  notes?: string;
}

// Training day offsets from Sunday for each split (0=Sun, 1=Mon, …, 6=Sat).
// Training itself still runs Mon–Sat (Sunday stays the rest day) — only the
// week *boundary* changed from Mon–Sun to Sun–Sat, so "this week" on a Sunday
// means the week starting today, not the tail end of the week that just ended.
const SPLIT_DAY_OFFSETS: Record<string, number[]> = {
  ppl:         [1, 2, 3, 4, 5, 6],   // Mon–Sat
  upper_lower: [1, 2, 4, 5],          // Mon, Tue, Thu, Fri
  full_body:   [1, 3, 5],             // Mon, Wed, Fri
  bro_split:   [1, 2, 3, 4, 5],       // Mon–Fri
};

/** The weekday offsets (0=Sun..6=Sat) a given split trains on, for callers that need to find free days to add cardio around it. */
export function getSplitOffsets(split: string): number[] {
  return SPLIT_DAY_OFFSETS[split] ?? [1, 3, 5];
}

function getSundayOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Generates and saves any missing WorkoutSession rows for the upcoming training
 * week (based on the profile's preferredSplit), skipping dates that already have
 * a session. Returns all sessions for that week (existing + newly created), sorted
 * by date, with exercises parsed to objects.
 */
export async function scheduleUpcomingWeek(
  userId: string,
  profileRow: FitnessProfileRow & { coachingNotes: string | null },
) {
  const split = profileRow.preferredSplit;
  const plan = getWorkoutPlan(split);
  if (!plan) {
    throw new Error(`Unknown split: ${split}`);
  }

  const weekStart = getSundayOfWeek(new Date());
  const offsets = SPLIT_DAY_OFFSETS[split] ?? [1, 3, 5];
  const weekDates = offsets.map((offset) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + offset);
    return toDateString(d);
  });

  const existingThisWeek = await prisma.workoutSession.findMany({
    where: { userId, date: { in: weekDates } },
  });
  const existingDates = new Set(existingThisWeek.map((s) => s.date));

  const rawRecent = await prisma.workoutSession.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 30,
  });

  const userProfile = toCalcUserProfile(profileRow);

  let coachingNotes: CoachingNotes | undefined;
  if (profileRow.coachingNotes) {
    try { coachingNotes = JSON.parse(profileRow.coachingNotes); } catch { /* ignore */ }
  }

  let runningSessions: WorkoutSession[] = rawRecent.map((s) => ({
    ...s,
    exercises: parseExercises(s.exercises),
  })) as unknown as WorkoutSession[];

  const seenDates = new Set<string>();
  const results: (Omit<typeof rawRecent[0], 'exercises'> & { exercises: unknown })[] = existingThisWeek
    .filter((s) => { if (seenDates.has(s.date)) return false; seenDates.add(s.date); return true; })
    .map((s) => ({ ...s, exercises: typeof s.exercises === 'string' ? JSON.parse(s.exercises) : s.exercises }));

  for (const date of weekDates) {
    if (existingDates.has(date)) continue;

    const generated = generateNextWorkout(userProfile, runningSessions, coachingNotes);
    generated.date = date;

    const saved = await prisma.workoutSession.create({
      data: {
        userId,
        sessionId: generated.sessionId,
        date: generated.date,
        name: generated.name,
        splitDay: generated.splitDay,
        exercises: JSON.stringify(generated.exercises),
        completed: false,
        weekNumber: generated.weekNumber,
        isDeload: generated.isDeload,
      },
    });

    results.push({ ...saved, exercises: generated.exercises });

    // Mark completed=true for chaining — generateNextWorkout only reads completed sessions
    // to determine the last splitDay. The DB record stays completed: false.
    runningSessions = [
      { ...generated, completed: true } as WorkoutSession,
      ...runningSessions,
    ];
  }

  results.sort((a, b) => a.date.localeCompare(b.date));
  return results;
}

/**
 * Adds standalone cardio/movement sessions on top of the split (e.g. extra
 * NEAT, zone-2 cardio the AI coach decides a goal needs) — skips any day that
 * already has a session so it never clobbers a split training day. No new
 * exercise-type machinery needed: these are just WorkoutSession rows with no
 * strength exercises, so they show up in history/dashboard like any other
 * logged session.
 */
export async function scheduleCardioSessions(
  userId: string,
  cardioSessions: CardioSessionInput[],
): Promise<Array<{ date: string; name: string }>> {
  if (cardioSessions.length === 0) return [];

  const weekStart = getSundayOfWeek(new Date());
  const weekNumber = getWeekNumber(weekStart);

  const dates = cardioSessions.map((c) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + Math.min(Math.max(c.dayOffset, 0), 6));
    return toDateString(d);
  });

  const existing = await prisma.workoutSession.findMany({
    where: { userId, date: { in: dates } },
    select: { date: true },
  });
  const existingDates = new Set(existing.map((s) => s.date));

  const created: Array<{ date: string; name: string }> = [];
  for (let i = 0; i < cardioSessions.length; i++) {
    const date = dates[i];
    if (existingDates.has(date)) continue; // don't clobber an existing split/logged day

    const cardio = cardioSessions[i];
    await prisma.workoutSession.create({
      data: {
        userId,
        sessionId: generateId(),
        date,
        name: cardio.name,
        splitDay: 'cardio',
        exercises: '[]',
        duration: cardio.durationMinutes,
        completed: false,
        weekNumber,
        isDeload: false,
        notes: cardio.notes,
      },
    });
    created.push({ date, name: cardio.name });
    existingDates.add(date); // guard against duplicate dayOffsets in the same call
  }

  return created;
}
