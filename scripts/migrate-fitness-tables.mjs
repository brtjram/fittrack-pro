/**
 * Creates fitness data tables in the Turso database.
 * Run: DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... node scripts/migrate-fitness-tables.mjs
 */
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const statements = [
  `CREATE TABLE IF NOT EXISTS "FitnessProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" TEXT NOT NULL,
    "heightCm" REAL NOT NULL,
    "currentWeightLbs" REAL NOT NULL,
    "targetWeightLbs" REAL NOT NULL,
    "activityLevel" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "experienceLevel" TEXT NOT NULL,
    "preferredSplit" TEXT NOT NULL,
    "healthSyncApiKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FitnessProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS "WorkoutSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL UNIQUE,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "splitDay" TEXT NOT NULL,
    "exercises" TEXT NOT NULL,
    "duration" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "weekNumber" INTEGER NOT NULL DEFAULT 1,
    "isDeload" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS "WorkoutSession_userId_date_idx" ON "WorkoutSession"("userId", "date")`,

  `CREATE TABLE IF NOT EXISTS "PersonalRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "exerciseName" TEXT NOT NULL,
    "weight" REAL NOT NULL,
    "reps" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonalRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS "PersonalRecord_userId_exerciseId_idx" ON "PersonalRecord"("userId", "exerciseId")`,

  `CREATE TABLE IF NOT EXISTS "FoodLogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "foodItemId" TEXT NOT NULL,
    "foodName" TEXT NOT NULL,
    "servings" REAL NOT NULL,
    "servingSizeG" REAL NOT NULL,
    "meal" TEXT NOT NULL,
    "calories" REAL NOT NULL,
    "protein" REAL NOT NULL,
    "carbs" REAL NOT NULL,
    "fat" REAL NOT NULL,
    "fiber" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FoodLogEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS "FoodLogEntry_userId_date_idx" ON "FoodLogEntry"("userId", "date")`,

  `CREATE TABLE IF NOT EXISTS "NutritionAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "previousCalories" REAL NOT NULL,
    "newCalories" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "weeklyWeightChange" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NutritionAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS "NutritionAdjustment_userId_date_idx" ON "NutritionAdjustment"("userId", "date")`,

  `CREATE TABLE IF NOT EXISTS "WeightEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "weightLbs" REAL NOT NULL,
    "bodyFatPercent" REAL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeightEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "WeightEntry_userId_date_key" ON "WeightEntry"("userId", "date")`,

  `CREATE TABLE IF NOT EXISTS "DailyActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "steps" INTEGER NOT NULL,
    "activeCalories" INTEGER NOT NULL,
    "restingHeartRate" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "DailyActivity_userId_date_key" ON "DailyActivity"("userId", "date")`,

  // Added for AI coach memory / AI coach goal mode / MCP access tokens.
  // ALTER TABLE ADD COLUMN fails (caught below, non-fatal) if the column already exists.
  `ALTER TABLE "FitnessProfile" ADD COLUMN "aiCoachGoal" TEXT`,

  // Added for the Units preferences screen (profile redesign turn 4d).
  `ALTER TABLE "FitnessProfile" ADD COLUMN "weightUnit" TEXT NOT NULL DEFAULT 'lb'`,
  `ALTER TABLE "FitnessProfile" ADD COLUMN "heightUnit" TEXT NOT NULL DEFAULT 'cm'`,
  `ALTER TABLE "FitnessProfile" ADD COLUMN "energyUnit" TEXT NOT NULL DEFAULT 'kcal'`,
  `ALTER TABLE "FitnessProfile" ADD COLUMN "weekStartsOn" TEXT NOT NULL DEFAULT 'mon'`,

  // Added for the Split & schedule screen (profile redesign turn 4c).
  `ALTER TABLE "FitnessProfile" ADD COLUMN "trainingDays" TEXT NOT NULL DEFAULT '1,2,4,5,6'`,
  `ALTER TABLE "FitnessProfile" ADD COLUMN "sessionLengthMin" INTEGER NOT NULL DEFAULT 60`,

  `CREATE TABLE IF NOT EXISTS "CoachMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS "CoachMemory_userId_createdAt_idx" ON "CoachMemory"("userId", "createdAt")`,

  `CREATE TABLE IF NOT EXISTS "ApiToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash")`,
  `CREATE INDEX IF NOT EXISTS "ApiToken_userId_idx" ON "ApiToken"("userId")`,

  // Added for weigh-in waist measurement + progress photos.
  `ALTER TABLE "WeightEntry" ADD COLUMN "waistIn" REAL`,

  `CREATE TABLE IF NOT EXISTS "ProgressPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "blobPathname" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProgressPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "ProgressPhoto_userId_date_angle_key" ON "ProgressPhoto"("userId", "date", "angle")`,
];

async function migrate() {
  console.log('Creating fitness data tables...');
  for (const sql of statements) {
    const tableName = sql.match(/"(\w+)"/)?.[1] || 'index';
    try {
      await client.execute(sql);
      console.log(`  ✓ ${tableName}`);
    } catch (e) {
      console.error(`  ✗ ${tableName}:`, e.message);
    }
  }
  console.log('Done!');
}

migrate().catch(console.error);
