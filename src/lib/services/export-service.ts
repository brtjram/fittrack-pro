import { prisma } from '@/lib/prisma';

export type ExportSection = 'meals' | 'workouts' | 'weighins';
export type ExportFormat = 'csv' | 'json';
export type ExportRange = '90' | 'all';

function cutoffDate(range: ExportRange): string | null {
  if (range === 'all') return null;
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().split('T')[0];
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsvBlock(title: string, rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return `## ${title}\n(no entries)\n`;
  const headers = Object.keys(rows[0]);
  const lines = [
    `## ${title}`,
    headers.join(','),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(',')),
  ];
  return lines.join('\n') + '\n';
}

export async function buildExport(
  userId: string,
  sections: ExportSection[],
  format: ExportFormat,
  range: ExportRange,
): Promise<{ content: string; mimeType: string; filenameExt: string; counts: Record<ExportSection, number> }> {
  const since = cutoffDate(range);
  const dateFilter = since ? { date: { gte: since } } : {};

  const counts: Record<ExportSection, number> = { meals: 0, workouts: 0, weighins: 0 };
  const data: Partial<Record<ExportSection, Record<string, unknown>[]>> = {};

  if (sections.includes('meals')) {
    const entries = await prisma.foodLogEntry.findMany({
      where: { userId, ...dateFilter },
      orderBy: { date: 'desc' },
    });
    data.meals = entries.map((e) => ({
      date: e.date, meal: e.meal, food: e.foodName, servings: e.servings,
      servingSizeG: e.servingSizeG, calories: e.calories, protein: e.protein,
      carbs: e.carbs, fat: e.fat, fiber: e.fiber ?? '',
    }));
    counts.meals = entries.length;
  }

  if (sections.includes('workouts')) {
    const sessions = await prisma.workoutSession.findMany({
      where: { userId, ...dateFilter },
      orderBy: { date: 'desc' },
    });
    data.workouts = sessions.map((s) => ({
      date: s.date, name: s.name, splitDay: s.splitDay, durationMin: s.duration ?? '',
      completed: s.completed, weekNumber: s.weekNumber, rating: s.rating ?? '',
      notes: s.notes ?? '', exercises: s.exercises,
    }));
    counts.workouts = sessions.length;
  }

  if (sections.includes('weighins')) {
    const weights = await prisma.weightEntry.findMany({
      where: { userId, ...dateFilter },
      orderBy: { date: 'desc' },
    });
    data.weighins = weights.map((w) => ({
      date: w.date, weightLbs: w.weightLbs, bodyFatPercent: w.bodyFatPercent ?? '', note: w.note ?? '',
    }));
    counts.weighins = weights.length;
  }

  if (format === 'json') {
    return {
      content: JSON.stringify({ exportedAt: new Date().toISOString(), range, ...data }, null, 2),
      mimeType: 'application/json',
      filenameExt: 'json',
      counts,
    };
  }

  const titles: Record<ExportSection, string> = {
    meals: 'Meals & macros', workouts: 'Workouts & sets', weighins: 'Weigh-ins',
  };
  const blocks = sections.map((s) => toCsvBlock(titles[s], data[s] ?? []));
  return { content: blocks.join('\n'), mimeType: 'text/csv', filenameExt: 'csv', counts };
}
