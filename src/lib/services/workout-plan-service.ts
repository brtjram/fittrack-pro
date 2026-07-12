import { prisma } from '@/lib/prisma';
import { generateNextWorkout, type CoachingNotes } from '@/lib/algorithms/workout-generator';
import { getWorkoutPlan } from '@/lib/data/workout-templates';
import { parseExercises } from '@/lib/utils';
import { toCalcUserProfile, type FitnessProfileRow } from './fitness-profile-adapter';
import type { WorkoutSession } from '@/types';

// Training day offsets from Monday for each split (0=Mon, 1=Tue, …, 6=Sun)
const SPLIT_DAY_OFFSETS: Record<string, number[]> = {
  ppl:         [0, 1, 2, 3, 4, 5],   // Mon–Sat
  upper_lower: [0, 1, 3, 4],          // Mon, Tue, Thu, Fri
  full_body:   [0, 2, 4],             // Mon, Wed, Fri
  bro_split:   [0, 1, 2, 3, 4],       // Mon–Fri
};

function getMondayOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
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

  const monday = getMondayOfWeek(new Date());
  const offsets = SPLIT_DAY_OFFSETS[split] ?? [0, 2, 4];
  const weekDates = offsets.map((offset) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + offset);
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
