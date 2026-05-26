import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  if (secret !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const profiles = await prisma.$queryRawUnsafe('SELECT id, userId, name FROM FitnessProfile LIMIT 10');
  const users = await prisma.$queryRawUnsafe('SELECT id, email FROM User WHERE email LIKE ? LIMIT 5', '%brtjram%');
  return NextResponse.json({ profiles, users });
}

// Temporary migration endpoint — remove after applying to prod
export async function POST(request: Request) {
  const { secret } = await request.json() as { secret?: string };
  if (secret !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const results: Record<string, string> = {};

  // Step 1: Recreate FitnessProfile with BOOLEAN trackCycle
  // Current prod state after failed prior migration:
  //   FitnessProfile      = empty new table (correct BOOLEAN schema, no data)
  //   FitnessProfile_old  = original table with production data (original columns only)
  // Goal: populate FitnessProfile from FitnessProfile_old, then clean up
  const steps = [
    // Copy original columns only — new columns get their DEFAULT values
    ['copy_fp', `INSERT INTO FitnessProfile (id, userId, name, age, gender, heightCm, currentWeightLbs, targetWeightLbs, activityLevel, goal, experienceLevel, preferredSplit, healthSyncApiKey, createdAt, updatedAt) SELECT id, userId, name, age, gender, heightCm, currentWeightLbs, targetWeightLbs, activityLevel, goal, experienceLevel, preferredSplit, healthSyncApiKey, createdAt, updatedAt FROM FitnessProfile_old`],
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
      if (name === 'copy_fp') {
        return NextResponse.json({ results, stopped: true }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ results });
}
