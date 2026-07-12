import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

interface ImportRow {
  date: string;
  weightLbs?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

// Generic import for third-party weight/nutrition exports (MacroFactor, MyFitnessPal,
// etc). MacroFactor has no live API — this is the one-time bridge that brings its
// history into FitTrack Pro so it shows up alongside Apple Health activity and
// FitTrack's own workout data (see /api/mcp/summary, which reads all of it together).
export async function POST(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const body = await request.json().catch(() => null);
  const rows = body?.rows as ImportRow[] | undefined;
  const source = typeof body?.source === 'string' && body.source.trim() ? body.source.trim() : 'CSV import';

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import.' }, { status: 400 });
  }

  let weightRowsImported = 0;
  let nutritionRowsImported = 0;
  const importTag = `Imported (${source})`;

  for (const row of rows) {
    if (!row.date) continue;

    if (typeof row.weightLbs === 'number' && row.weightLbs > 0) {
      await prisma.weightEntry.upsert({
        where: { userId_date: { userId, date: row.date } },
        update: { weightLbs: row.weightLbs },
        create: { userId, date: row.date, weightLbs: row.weightLbs },
      });
      weightRowsImported++;
    }

    if (typeof row.calories === 'number' && row.calories > 0) {
      await prisma.foodLogEntry.deleteMany({ where: { userId, date: row.date, foodName: importTag } });
      await prisma.foodLogEntry.create({
        data: {
          userId,
          date: row.date,
          foodItemId: `import-${source.toLowerCase().replace(/\s+/g, '-')}-${row.date}`,
          foodName: importTag,
          servings: 1,
          servingSizeG: 0,
          meal: 'snack',
          calories: row.calories,
          protein: row.protein ?? 0,
          carbs: row.carbs ?? 0,
          fat: row.fat ?? 0,
        },
      });
      nutritionRowsImported++;
    }
  }

  return NextResponse.json({ weightRowsImported, nutritionRowsImported });
}
