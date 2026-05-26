import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Temporary migration endpoint — remove after applying to prod
export async function POST(request: Request) {
  const { secret } = await request.json() as { secret?: string };
  if (secret !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const results: Record<string, string> = {};

  // Step 1: Recreate FitnessProfile with BOOLEAN trackCycle
  const steps = [
    ['rename_fp', 'ALTER TABLE FitnessProfile RENAME TO FitnessProfile_old'],
    ['create_fp', `CREATE TABLE FitnessProfile (id TEXT NOT NULL PRIMARY KEY, userId TEXT NOT NULL UNIQUE, name TEXT NOT NULL, age INTEGER NOT NULL, gender TEXT NOT NULL, heightCm REAL NOT NULL, currentWeightLbs REAL NOT NULL, targetWeightLbs REAL NOT NULL, activityLevel TEXT NOT NULL, goal TEXT NOT NULL, experienceLevel TEXT NOT NULL, preferredSplit TEXT NOT NULL, healthSyncApiKey TEXT, trackCycle BOOLEAN NOT NULL DEFAULT false, cycleLength INTEGER, lastPeriodDate TEXT, stepTarget INTEGER NOT NULL DEFAULT 10000, coachingNotes TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE)`],
    ['copy_fp', `INSERT INTO FitnessProfile (id, userId, name, age, gender, heightCm, currentWeightLbs, targetWeightLbs, activityLevel, goal, experienceLevel, preferredSplit, healthSyncApiKey, trackCycle, cycleLength, lastPeriodDate, stepTarget, coachingNotes, createdAt, updatedAt) SELECT id, userId, name, age, gender, heightCm, currentWeightLbs, targetWeightLbs, activityLevel, goal, experienceLevel, preferredSplit, healthSyncApiKey, COALESCE(trackCycle, 0), cycleLength, lastPeriodDate, COALESCE(stepTarget, 10000), coachingNotes, createdAt, updatedAt FROM FitnessProfile_old`],
    ['drop_fp_old', 'DROP TABLE FitnessProfile_old'],
    ['drop_tc', 'DROP TABLE IF EXISTS TransformationChallenge'],
    ['create_tc', `CREATE TABLE TransformationChallenge (id TEXT NOT NULL PRIMARY KEY, userId TEXT NOT NULL UNIQUE, startDate TEXT NOT NULL, startWeightLbs REAL NOT NULL, targetWeightLbs REAL NOT NULL, currentWeek INTEGER NOT NULL DEFAULT 1, isActive BOOLEAN NOT NULL DEFAULT true, weeklyData TEXT NOT NULL DEFAULT '[]', notes TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE)`],
  ];

  for (const [name, sql] of steps) {
    try {
      await prisma.$executeRawUnsafe(sql);
      results[name] = 'ok';
    } catch (e: unknown) {
      results[name] = `error: ${(e as Error).message}`;
      // Stop on critical failures
      if (name === 'rename_fp' || name === 'create_fp' || name === 'copy_fp') {
        return NextResponse.json({ results, stopped: true }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ results });
}
