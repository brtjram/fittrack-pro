import { NextRequest, NextResponse } from 'next/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { calculateMacroTargets } from '@/lib/algorithms/macro-calculator';
import { toCalcUserProfile } from '@/lib/services/fitness-profile-adapter';
import { getRecentCoachMemories, formatCoachMemoriesForPrompt } from '@/lib/services/coach-memory-service';
import { parseExercises } from '@/lib/utils';
import {
  saveCoachingInstructionsAction,
  scheduleWorkoutPlanAction,
  setNutritionTargetsAction,
  setAiCoachGoalAction,
  rememberInsightAction,
} from '@/lib/services/coach-actions-service';
import type { WorkoutSplit } from '@/types';

// Remote MCP endpoint (Streamable HTTP transport) so web-based MCP clients —
// Claude.ai's connectors, ChatGPT, etc. — can connect directly over HTTPS,
// unlike @fittrack/mcp-server (packages/mcp-server) which is a local stdio
// process for Claude Desktop / Claude Code. Same tools, same ftmcp_ token
// auth, same underlying services — just a different transport, and these
// call the service functions directly instead of round-tripping through the
// /api/mcp/* REST endpoints the stdio server proxies to.

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(err: unknown) {
  return {
    content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }],
    isError: true,
  };
}

function buildServer(userId: string) {
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
        const [profile, recentWorkouts, recentFoodLog, recentWeight, recentActivity, challenge, memories] = await Promise.all([
          prisma.fitnessProfile.findUnique({ where: { userId } }),
          prisma.workoutSession.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 10 }),
          prisma.foodLogEntry.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 50 }),
          prisma.weightEntry.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 30 }),
          prisma.dailyActivity.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 14 }),
          prisma.transformationChallenge.findUnique({ where: { userId } }),
          getRecentCoachMemories(userId, 100),
        ]);

        if (!profile) {
          return errorResult('No fitness profile found for this user yet.');
        }

        const macroTargets = calculateMacroTargets(toCalcUserProfile(profile));

        return textResult({
          profile,
          nutritionTargets: macroTargets,
          recentWorkouts: recentWorkouts.map((s) => ({ ...s, exercises: parseExercises(s.exercises) })),
          recentFoodLog,
          recentWeight,
          recentActivity,
          transformationChallenge: challenge,
          coachMemory: {
            entries: memories,
            formatted: formatCoachMemoriesForPrompt(memories),
          },
        });
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
        return textResult(await getRecentCoachMemories(userId, limit ?? 100));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

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
        const profile = await prisma.fitnessProfile.findUnique({ where: { userId } });
        if (!profile) return errorResult('No fitness profile found for this user yet.');
        const result = await setNutritionTargetsAction(userId, profile, input);
        return textResult({ resultText: result.resultText, profile: result.profile });
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'schedule_workout_plan',
    {
      title: "Schedule this week's workouts",
      description:
        "Generate and save the user's workouts for the upcoming week directly to their training log in FitTrack " +
        'Pro, so they show up as real scheduled sessions. In AI Coach Mode you own the training split and daily ' +
        'step target — set them here based on the goal. Any active coaching intensity preferences are applied automatically.',
      inputSchema: {
        split: z
          .enum(['ppl', 'upper_lower', 'full_body', 'bro_split'])
          .optional()
          .describe('Change the training split going forward. Omit to keep the current split.'),
        stepTarget: z
          .number()
          .optional()
          .describe('Daily step target in AI Coach Mode — the only way it gets set, since the user has no manual step goal input in this mode.'),
        cardioSessions: z
          .array(z.object({
            dayOffset: z.number().int().min(0).max(6).describe('0 = Monday of this week, 6 = Sunday.'),
            name: z.string().describe('e.g. "Zone 2 Cardio" or "Incline Walk".'),
            durationMinutes: z.number().optional().describe('Prescribed duration in minutes.'),
            notes: z.string().optional().describe('Guidance for the session (intensity, heart rate zone, etc).'),
          }))
          .optional()
          .describe('Standalone cardio/movement sessions to add on top of the split, if the goal calls for it. Days that already have a session are skipped.'),
      },
    },
    async (input) => {
      try {
        const profile = await prisma.fitnessProfile.findUnique({ where: { userId } });
        if (!profile) return errorResult('No fitness profile found for this user yet.');
        const result = await scheduleWorkoutPlanAction(userId, profile, input as {
          split?: WorkoutSplit;
          stepTarget?: number;
          cardioSessions?: { dayOffset: number; name: string; durationMinutes?: number; notes?: string }[];
        });
        return textResult({ resultText: result.resultText, profile: result.profile });
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
        const profile = await prisma.fitnessProfile.findUnique({ where: { userId } });
        if (!profile) return errorResult('No fitness profile found for this user yet.');
        const result = await saveCoachingInstructionsAction(userId, profile, input);
        return textResult({ resultText: result.resultText, profile: result.profile });
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
        const profile = await prisma.fitnessProfile.findUnique({ where: { userId } });
        if (!profile) return errorResult('No fitness profile found for this user yet.');
        const result = await setAiCoachGoalAction(userId, profile, input);
        return textResult({ resultText: result.resultText, profile: result.profile });
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
        const result = await rememberInsightAction(userId, input);
        return textResult(result);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  return server;
}

async function handleMcpRequest(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const server = buildServer(userId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: one server+transport per request, fine for serverless
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function GET(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleMcpRequest(request);
}
