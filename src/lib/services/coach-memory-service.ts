import { prisma } from '@/lib/prisma';

export type CoachMemoryCategory = 'insight' | 'preference' | 'constraint' | 'action' | 'outcome';

export interface CoachMemoryEntry {
  category: CoachMemoryCategory;
  content: string;
  pinned?: boolean;
}

// How many unpinned memories to keep per user. Pinned memories (injuries,
// allergies, hard constraints) are never pruned.
const MAX_UNPINNED_MEMORIES = 300;
// How many memories get pulled into a single chat system prompt.
const PROMPT_MEMORY_LIMIT = 30;

/**
 * Persist a coaching memory and opportunistically prune old unpinned entries
 * so a multi-year account doesn't grow the per-request prompt unbounded.
 */
export async function addCoachMemory(
  userId: string,
  entry: CoachMemoryEntry,
): Promise<void> {
  await prisma.coachMemory.create({
    data: {
      userId,
      category: entry.category,
      content: entry.content,
      pinned: entry.pinned ?? false,
    },
  });

  const unpinnedCount = await prisma.coachMemory.count({ where: { userId, pinned: false } });
  if (unpinnedCount > MAX_UNPINNED_MEMORIES) {
    const stale = await prisma.coachMemory.findMany({
      where: { userId, pinned: false },
      orderBy: { createdAt: 'asc' },
      take: unpinnedCount - MAX_UNPINNED_MEMORIES,
      select: { id: true },
    });
    await prisma.coachMemory.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }
}

/**
 * Load the memory this user's coach should have in context: pinned facts
 * first (always included), then the most recent general memories.
 */
export async function getRecentCoachMemories(userId: string, limit = PROMPT_MEMORY_LIMIT) {
  const pinned = await prisma.coachMemory.findMany({
    where: { userId, pinned: true },
    orderBy: { createdAt: 'desc' },
  });

  const remaining = Math.max(limit - pinned.length, 0);
  const recent = remaining > 0
    ? await prisma.coachMemory.findMany({
        where: { userId, pinned: false },
        orderBy: { createdAt: 'desc' },
        take: remaining,
      })
    : [];

  // Chronological order reads more naturally than recency-first.
  return [...pinned, ...recent].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

const CATEGORY_LABEL: Record<CoachMemoryCategory, string> = {
  insight: 'What works for this user',
  preference: 'Preferences',
  constraint: 'Constraints (injuries, limitations, allergies)',
  action: 'Past coaching actions',
  outcome: 'Outcomes of past changes',
};

export function formatCoachMemoriesForPrompt(
  memories: Awaited<ReturnType<typeof getRecentCoachMemories>>,
): string | null {
  if (memories.length === 0) return null;

  const byCategory = new Map<CoachMemoryCategory, string[]>();
  for (const m of memories) {
    const category = (m.category as CoachMemoryCategory) in CATEGORY_LABEL
      ? (m.category as CoachMemoryCategory)
      : 'insight';
    const list = byCategory.get(category) ?? [];
    const date = m.createdAt.toISOString().split('T')[0];
    list.push(`${m.content}${m.pinned ? ' (always applies)' : ` (${date})`}`);
    byCategory.set(category, list);
  }

  const sections = Array.from(byCategory.entries()).map(
    ([category, items]) => `${CATEGORY_LABEL[category]}:\n- ${items.join('\n- ')}`,
  );

  return sections.join('\n\n');
}
