import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

// Zero-query food suggestions — MacroFactor surfaces favorites/recent/frequent
// foods before the user types anything, which is a big part of why it feels
// fast. This ranks by frequency first (your actual staples), then recency,
// and dedupes by foodItemId+name so the same food logged many times only
// shows once (using its most recent logged macros/serving).
export async function GET(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const url = new URL(request.url);
  const meal = url.searchParams.get('meal');
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 12, 1), 30);

  const entries = await prisma.foodLogEntry.findMany({
    where: { userId, ...(meal ? { meal } : {}) },
    orderBy: { date: 'desc' },
    take: 300,
  });

  const byKey = new Map<string, { entry: (typeof entries)[number]; count: number }>();
  for (const entry of entries) {
    const key = `${entry.foodItemId}::${entry.foodName}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count++;
    } else {
      byKey.set(key, { entry, count: 1 });
    }
  }

  const ranked = Array.from(byKey.values())
    .sort((a, b) => b.count - a.count || b.entry.date.localeCompare(a.entry.date))
    .slice(0, limit)
    .map(({ entry, count }) => ({
      id: entry.foodItemId,
      name: entry.foodName,
      caloriesPer100g: entry.servingSizeG > 0 ? (entry.calories / entry.servingSizeG) * 100 : entry.calories,
      proteinPer100g: entry.servingSizeG > 0 ? (entry.protein / entry.servingSizeG) * 100 : entry.protein,
      carbsPer100g: entry.servingSizeG > 0 ? (entry.carbs / entry.servingSizeG) * 100 : entry.carbs,
      fatPer100g: entry.servingSizeG > 0 ? (entry.fat / entry.servingSizeG) * 100 : entry.fat,
      servingSizeG: entry.servingSizeG,
      servingLabel: `${entry.servingSizeG}g`,
      category: 'recent' as const,
      timesLogged: count,
    }));

  return NextResponse.json(ranked);
}
