#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE_URL = (process.env.FITTRACK_BASE_URL ?? '').replace(/\/$/, '');
const API_TOKEN = process.env.FITTRACK_API_TOKEN ?? '';

if (!BASE_URL || !API_TOKEN) {
  console.error(
    'fittrack-mcp: set FITTRACK_BASE_URL (e.g. https://your-app.vercel.app) and ' +
    'FITTRACK_API_TOKEN (generate one at /settings/mcp in the FitTrack Pro app) as environment variables.',
  );
  process.exit(1);
}

async function fittrackFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_TOKEN}`,
      ...init?.headers,
    },
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    throw new Error(`FitTrack API error (${res.status}): ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(err: unknown) {
  return {
    content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }],
    isError: true,
  };
}

const server = new McpServer({ name: 'fittrack-pro', version: '0.1.0' });

server.registerTool(
  'get_fittrack_summary',
  {
    title: 'Get FitTrack Pro summary',
    description:
      "One-call snapshot of this user's FitTrack Pro data: profile, current nutrition targets, recent workouts, " +
      'recent food log, recent weight and daily activity (including anything synced from Apple Health or imported ' +
      'from MacroFactor), active transformation challenge, and accumulated coaching memory. Call this first to get ' +
      'full context before giving advice or taking action.',
  },
  async () => {
    try {
      return textResult(await fittrackFetch('/api/mcp/summary'));
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  'get_coach_memory',
  {
    title: 'Get coaching memory',
    description:
      'Full long-term coaching memory for this user: preferences, constraints (injuries/allergies), insights, ' +
      'past coaching actions, and outcomes, accumulated across every past coaching session (in-app and MCP).',
    inputSchema: {
      limit: z.number().int().min(1).max(500).optional().describe('Max entries to return (default 100).'),
    },
  },
  async ({ limit }) => {
    try {
      const query = limit ? `?limit=${limit}` : '';
      return textResult(await fittrackFetch(`/api/mcp/coach-memory${query}`));
    } catch (err) {
      return errorResult(err);
    }
  },
);

async function coachAction(action: string, input: Record<string, unknown>) {
  return fittrackFetch('/api/mcp/coach-actions', {
    method: 'POST',
    body: JSON.stringify({ action, input }),
  });
}

server.registerTool(
  'set_nutrition_targets',
  {
    title: 'Set nutrition targets',
    description:
      "Set the user's real daily calorie and macro targets, overriding the auto-calculated targets shown " +
      'throughout FitTrack Pro. These become the user\'s actual daily nutrition goal in the app.',
    inputSchema: {
      calories: z.number().describe('Daily calorie target.'),
      protein: z.number().optional().describe('Daily protein target in grams. Omit to keep the auto-calculated target.'),
      carbs: z.number().optional().describe('Daily carb target in grams. Omit to auto-balance from remaining calories.'),
      fat: z.number().optional().describe('Daily fat target in grams. Omit to auto-balance from remaining calories.'),
      reason: z.string().describe('Short reason for the change, shown in the adjustment history.'),
    },
  },
  async (input) => {
    try {
      return textResult(await coachAction('set_nutrition_targets', input));
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  'schedule_workout_plan',
  {
    title: 'Schedule this week’s workouts',
    description:
      "Generate and save the user's workouts for the upcoming week directly to their training log in FitTrack " +
      'Pro, so they show up as real scheduled sessions. Any active coaching intensity preferences are applied automatically.',
    inputSchema: {
      split: z
        .enum(['ppl', 'upper_lower', 'full_body', 'bro_split'])
        .optional()
        .describe('Change the training split going forward. Omit to keep the current split.'),
    },
  },
  async (input) => {
    try {
      return textResult(await coachAction('schedule_workout_plan', input));
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  'save_coaching_instructions',
  {
    title: 'Save training instructions',
    description:
      'Save workout intensity/load/exercise instructions so they persist and affect every future generated workout ' +
      'in FitTrack Pro. For nutrition/calorie/macro changes, use set_nutrition_targets instead.',
    inputSchema: {
      intensityModifier: z
        .number()
        .optional()
        .describe('Global multiplier for workout weights/intensity. 1.0 = no change, 1.1 = 10% heavier, 0.9 = 10% lighter.'),
      exerciseOverrides: z
        .record(z.string(), z.object({ intensityModifier: z.number().optional(), notes: z.string().optional() }))
        .optional()
        .describe('Per-exercise overrides keyed by exercise name.'),
      generalNotes: z.string().optional().describe('Free-text training preferences (e.g. "more leg volume").'),
    },
  },
  async (input) => {
    try {
      return textResult(await coachAction('save_coaching_instructions', input));
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  'set_ai_coach_goal',
  {
    title: 'Set AI Coach Mode goal',
    description:
      "Switch the user into AI Coach Mode with a specific stated goal (e.g. training for an event, or anything " +
      "that doesn't fit fat_loss/muscle_gain/recomp/maintain). This becomes the source of truth for nutrition and " +
      'training instead of a generic preset — follow up with set_nutrition_targets and schedule_workout_plan to ' +
      'turn it into concrete daily/weekly targets.',
    inputSchema: {
      goalDescription: z.string().describe('Concise summary of what the user is training for.'),
    },
  },
  async (input) => {
    try {
      return textResult(await coachAction('set_ai_coach_goal', input));
    } catch (err) {
      return errorResult(err);
    }
  },
);

server.registerTool(
  'remember_insight',
  {
    title: 'Remember a coaching insight',
    description:
      'Save a durable fact about the user to long-term coaching memory so it carries into every future session — ' +
      'in this MCP client, any other MCP client, and the in-app FitTrack Pro coach chat. Use for injuries, allergies, ' +
      "preferences, and outcomes of things that were tried.",
    inputSchema: {
      category: z
        .enum(['insight', 'preference', 'constraint', 'outcome'])
        .describe(
          "'constraint' = injuries/allergies/hard limits (always applied). 'preference' = likes/dislikes. " +
          "'insight' = a pattern noticed about what works. 'outcome' = the result of a change that was tried.",
        ),
      content: z.string().describe('One or two sentences, written so it can be acted on directly later.'),
    },
  },
  async (input) => {
    try {
      return textResult(await coachAction('remember_insight', input));
    } catch (err) {
      return errorResult(err);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('fittrack-mcp: connected via stdio');
