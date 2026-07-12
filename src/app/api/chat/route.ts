import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { getRecentCoachMemories, formatCoachMemoriesForPrompt } from '@/lib/services/coach-memory-service';
import {
  type CoachingNotes,
  formatCoachingNotes,
  saveCoachingInstructionsAction,
  scheduleWorkoutPlanAction,
  setNutritionTargetsAction,
  setAiCoachGoalAction,
  rememberInsightAction,
} from '@/lib/services/coach-actions-service';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getCyclePhase(lastPeriodDate: string, cycleLength: number): string {
  const last = new Date(lastPeriodDate);
  const today = new Date();
  const dayOfCycle = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)) % cycleLength + 1;

  if (dayOfCycle <= 5) return `Menstrual phase (day ${dayOfCycle}) — energy may be lower, prioritize gentle movement or rest`;
  if (dayOfCycle <= 13) return `Follicular phase (day ${dayOfCycle}) — energy rising, great for strength and intensity`;
  if (dayOfCycle <= 16) return `Ovulation phase (day ${dayOfCycle}) — peak energy and strength, push hard`;
  return `Luteal phase (day ${dayOfCycle}) — energy declining, moderate intensity, listen to your body`;
}

function formatNutritionOverride(raw: string): string | null {
  try {
    const override = JSON.parse(raw) as { calories?: number; protein?: number; carbs?: number; fat?: number; reason?: string };
    if (typeof override.calories !== 'number') return null;
    return `${override.calories} kcal, ${override.protein}g protein, ${override.carbs}g carbs, ${override.fat}g fat${override.reason ? ` (${override.reason})` : ''}`;
  } catch {
    return null;
  }
}

const saveCoachingInstructionsTool: Anthropic.Tool = {
  name: 'save_coaching_instructions',
  description: 'Save training instructions given by the user so they persist and affect future workouts. Use this whenever the user explicitly asks to change workout intensity, load, or exercise difficulty. For nutrition/calorie/macro changes, use set_nutrition_targets instead.',
  input_schema: {
    type: 'object' as const,
    properties: {
      intensityModifier: {
        type: 'number',
        description: 'Global multiplier for workout weights/intensity. 1.0 = no change, 1.1 = 10% heavier, 0.9 = 10% lighter. Only set if user requests a general intensity change.',
      },
      exerciseOverrides: {
        type: 'object',
        description: 'Per-exercise overrides keyed by exercise name.',
        additionalProperties: {
          type: 'object',
          properties: {
            intensityModifier: { type: 'number', description: 'Multiplier for this exercise specifically.' },
            notes: { type: 'string', description: 'Reason or context (e.g., "recovering from injury").' },
          },
        },
      },
      generalNotes: {
        type: 'string',
        description: 'Free-text training preferences (e.g., "more leg volume", "swap deadlifts for RDLs").',
      },
    },
    required: [],
  },
};

const scheduleWorkoutPlanTool: Anthropic.Tool = {
  name: 'schedule_workout_plan',
  description: "Generate and save the user's workouts for the upcoming week directly to their training log, so a plan discussed in chat actually shows up as real scheduled sessions rather than just being talked about. Use this whenever the user asks you to plan, schedule, set up, or regenerate their workouts for the week. In AI Coach Mode, you own the training split and daily step target — the user is never asked to pick them, so set them here as part of building the plan. Feel free to prescribe extra cardio or movement sessions on top of the split when the goal calls for it (e.g. a fat-loss or endurance goal). Any active coaching intensity preferences are automatically applied.",
  input_schema: {
    type: 'object' as const,
    properties: {
      split: {
        type: 'string',
        enum: ['ppl', 'upper_lower', 'full_body', 'bro_split'],
        description: "Change the user's training split going forward (ppl = push/pull/legs, upper_lower, full_body, bro_split = body-part split). Omit to keep their current split.",
      },
      stepTarget: {
        type: 'number',
        description: 'Daily step target in AI Coach Mode. Set this based on the goal (e.g. higher for fat loss/endurance, lower if recovery-limited) — the user is not shown a manual step goal input in this mode, so this is the only way it gets set.',
      },
      cardioSessions: {
        type: 'array',
        description: 'Optional standalone cardio/movement sessions to add on top of the split this week, if the goal calls for it (e.g. zone-2 cardio, incline walks). Each becomes a real scheduled session; days that already have a session are skipped.',
        items: {
          type: 'object',
          properties: {
            dayOffset: { type: 'number', description: '0 = Monday of this week, 6 = Sunday.' },
            name: { type: 'string', description: 'e.g. "Zone 2 Cardio" or "Incline Walk".' },
            durationMinutes: { type: 'number', description: 'Prescribed duration in minutes.' },
            notes: { type: 'string', description: 'Any guidance for the session (intensity, heart rate zone, etc).' },
          },
          required: ['dayOffset', 'name'],
        },
      },
    },
    required: [],
  },
};

const setNutritionTargetsTool: Anthropic.Tool = {
  name: 'set_nutrition_targets',
  description: "Set the user's real daily calorie and macro targets, overriding the auto-calculated targets shown throughout the app's nutrition tracker. Use this whenever the user asks you to lock in, change, or set a specific calorie or macro goal (e.g. 'keep me at 2200 calories', 'bump my protein to 180g', 'set up a lean bulk at 2800 calories').",
  input_schema: {
    type: 'object' as const,
    properties: {
      calories: { type: 'number', description: 'Daily calorie target.' },
      protein: { type: 'number', description: 'Daily protein target in grams. Omit to keep the auto-calculated protein target.' },
      carbs: { type: 'number', description: 'Daily carb target in grams. Omit to auto-balance from remaining calories.' },
      fat: { type: 'number', description: 'Daily fat target in grams. Omit to auto-balance from remaining calories.' },
      reason: { type: 'string', description: 'Short reason for the change, shown in the adjustment history (e.g. "user requested lean bulk").' },
    },
    required: ['calories', 'reason'],
  },
};

const setAiCoachGoalTool: Anthropic.Tool = {
  name: 'set_ai_coach_goal',
  description: "Switch the user into AI Coach Mode with a specific stated goal (e.g. training for an event, a hybrid strength+endurance goal, or anything that doesn't fit the fat_loss/muscle_gain/recomp/maintain presets). This becomes the source of truth for their nutrition and training instead of a generic preset. After calling this, immediately follow up with set_nutrition_targets and schedule_workout_plan in the same turn to turn the goal into real daily/weekly targets — don't just save the description and stop.",
  input_schema: {
    type: 'object' as const,
    properties: {
      goalDescription: {
        type: 'string',
        description: 'A concise summary of what the user is training for, in their words where possible (e.g. "Marathon in 16 weeks while keeping current muscle mass").',
      },
    },
    required: ['goalDescription'],
  },
};

const rememberInsightTool: Anthropic.Tool = {
  name: 'remember_insight',
  description: "Save a durable fact about this user to long-term coaching memory so it carries into every future conversation, not just this one. Use this whenever the user reveals something that should shape future advice: an injury or physical limitation, a food they dislike or are allergic to, a training preference, what has or hasn't worked for them (adherence, energy, recovery), or the outcome of a change you previously made. Do not use this for one-off facts already captured by save_coaching_instructions or set_nutrition_targets — this is for things that should inform your judgment later, in words, not structured overrides.",
  input_schema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        enum: ['insight', 'preference', 'constraint', 'outcome'],
        description: "'constraint' = injuries/allergies/hard limits (always shown to you going forward). 'preference' = likes/dislikes. 'insight' = a pattern you've noticed about what works for this user. 'outcome' = the result of a change that was tried.",
      },
      content: {
        type: 'string',
        description: 'One or two sentences, written so future-you can act on it directly (e.g. "Knees hurt with high-rep leg presses — prefers lower rep ranges on quad-dominant isolation work.").',
      },
    },
    required: ['category', 'content'],
  },
};

export async function POST(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const { messages } = await request.json() as { messages: { role: 'user' | 'assistant'; content: string }[] };

  const [profile, challenge, coachMemories] = await Promise.all([
    prisma.fitnessProfile.findUnique({ where: { userId } }),
    prisma.transformationChallenge.findUnique({ where: { userId } }),
    getRecentCoachMemories(userId),
  ]);

  const todayDate = new Date().toISOString().split('T')[0];

  let systemPrompt = `Today's date is ${todayDate}.

You are a knowledgeable personal trainer and nutrition coach inside FitTrack Pro. Be concise, practical, and encouraging. Answer questions about workouts, nutrition, recovery, and fitness goals.

IMPORTANT: These tools make changes that actually take effect in the app, not just in conversation. Always use them (don't just describe the change in words) when the user's request matches:
- save_coaching_instructions: user wants workout intensity/load/exercise changes to persist for future generated workouts.
- schedule_workout_plan: user wants their upcoming week of workouts planned, scheduled, or regenerated.
- set_nutrition_targets: user wants a specific calorie or macro target locked in.
- remember_insight: user reveals an injury, allergy, preference, or the outcome of something you tried — save it so it shapes advice in every future session, not just this one.
Confirm to the user what you've saved/scheduled after calling a tool.

You have long-term memory of this user from past sessions (below, if any exists). Actively use it: reference what's worked or hasn't, respect stated constraints without being asked again, and let outcomes from past changes inform new recommendations instead of starting from scratch each time.`;

  const memoryContext = formatCoachMemoriesForPrompt(coachMemories);
  if (memoryContext) {
    systemPrompt += `\n\nCoaching memory (accumulated across past sessions):\n${memoryContext}`;
  }

  if (profile) {
    systemPrompt += `\n\nUser profile: ${profile.name}, ${profile.age}yo ${profile.gender}, ${profile.currentWeightLbs}lbs, goal: ${profile.goal}, experience: ${profile.experienceLevel}, split: ${profile.preferredSplit}.`;

    if (profile.goal === 'ai_coach') {
      systemPrompt += profile.aiCoachGoal
        ? `\n\nAI Coach Mode is active. The user's stated goal: "${profile.aiCoachGoal}". This goal — not a generic fat_loss/muscle_gain/recomp preset — is the source of truth for their nutrition and training. In this mode you own the training split and daily step target — the app doesn't ask the user to pick them, so set them yourself via schedule_workout_plan's split and stepTarget parameters based on what the goal actually needs, and add cardio/movement sessions on top of the split (schedule_workout_plan's cardioSessions) when appropriate. If they haven't been given concrete daily/weekly targets yet, or the goal has changed, use set_nutrition_targets and schedule_workout_plan (and save_coaching_instructions for training style changes) to translate it into real numbers now, then explain your reasoning briefly. Revisit and adjust these targets as the user reports progress, adherence, or a change in the goal — that's the point of this mode.`
        : `\n\nAI Coach Mode is active, but no goal description has been saved yet. Ask what the user is training for, then call set_ai_coach_goal with a concise summary, and immediately follow up with set_nutrition_targets and schedule_workout_plan to turn it into concrete daily/weekly targets.`;
    }

    if (profile.coachingNotes) {
      try {
        const notes: CoachingNotes = JSON.parse(profile.coachingNotes);
        const formatted = formatCoachingNotes(notes);
        if (formatted) {
          systemPrompt += `\n\nActive coaching preferences (saved from previous sessions):\n- ${formatted}`;
        }
      } catch {
        // ignore parse errors
      }
    }

    if (profile.nutritionTargetOverride) {
      const formatted = formatNutritionOverride(profile.nutritionTargetOverride);
      if (formatted) {
        systemPrompt += `\n\nActive nutrition target override (saved from previous sessions): ${formatted}`;
      }
    }

    if (profile.trackCycle && profile.lastPeriodDate && profile.cycleLength) {
      systemPrompt += `\n\nMenstrual cycle: ${getCyclePhase(profile.lastPeriodDate, profile.cycleLength)}. Factor this into training and recovery recommendations.`;
    }
  }

  if (challenge?.isActive) {
    const weeklyData = JSON.parse(challenge.weeklyData) as Array<{ week: number; endWeight?: number; avgDailySteps?: number }>;
    const phase = challenge.currentWeek <= 4 ? 1 : challenge.currentWeek <= 8 ? 2 : 3;
    const weightLost = challenge.startWeightLbs - (profile?.currentWeightLbs ?? challenge.startWeightLbs);
    const lastEntry = weeklyData[weeklyData.length - 1];
    const avgSteps = lastEntry?.avgDailySteps;
    systemPrompt += `\n\nTransformation Challenge: Active (Week ${challenge.currentWeek}/12, Phase ${phase})
- Started: ${challenge.startDate}, Start weight: ${challenge.startWeightLbs}lbs, Target: ${challenge.targetWeightLbs}lbs
- Progress: ${weightLost > 0 ? `-${weightLost.toFixed(1)}` : `+${Math.abs(weightLost).toFixed(1)}`}lbs so far${avgSteps ? `, last week avg ${avgSteps.toLocaleString()} steps/day` : ''}
- Phase ${phase} focus: ${phase === 1 ? 'establish baseline habits, moderate deficit (~300 cal), build consistency' : phase === 2 ? 'increase training intensity, tighten diet (~400 cal deficit), increase NEAT to 11k steps/day' : 'peak intensity, aggressive deficit (~500 cal), preserve muscle with heavy compounds, 12k steps/day'}
- Tailor all advice to the transformation challenge. Prioritize fat loss while protecting muscle.`;
  }

  // First pass: check if this message likely asks for a persisted change
  const lastUserMessage = messages[messages.length - 1];
  const keywordMightHaveInstructions = lastUserMessage?.role === 'user' &&
    /\b(intense|intensity|harder|heavier|lighter|easier|reduce|increase|lower|higher|less|more|change|adjust|modify|swap|replace|drop|add|switch|cut|maintain|focus|avoid|skip|plan|schedule|regenerate|generate|calorie|calories|macro|macros|diet|target|targets|bulk|deficit|surplus|protein|carbs|nutrition|workout|week|injur|hurt|pain|sore|allerg|prefer|dislike|hate|love|worked|working|isn't working|wasn't working|stall|plateau|energy|sleep|goal|marathon|race|train for|ai coach)\b/i.test(lastUserMessage.content);

  // AI Coach Mode with a stated goal but no targets set yet owes the user a
  // plan on the very next message, per the system prompt above — don't let
  // the keyword heuristic silently withhold tools until the user happens to
  // phrase a message that matches it.
  const aiCoachAwaitingPlan = profile?.goal === 'ai_coach' && !!profile.aiCoachGoal && !profile.nutritionTargetOverride;
  const mightHaveInstructions = lastUserMessage?.role === 'user' && (keywordMightHaveInstructions || aiCoachAwaitingPlan);

  if (mightHaveInstructions) {
    // Run with tools to potentially persist changes
    const toolResponse = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools: [saveCoachingInstructionsTool, scheduleWorkoutPlanTool, setNutritionTargetsTool, setAiCoachGoalTool, rememberInsightTool],
      tool_choice: { type: 'auto' },
    });

    const toolUseBlocks = toolResponse.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUseBlocks.length > 0) {
      // Track profile state locally as tools run in sequence, so a later tool
      // in the same turn (e.g. schedule_workout_plan) sees an earlier tool's
      // writes (e.g. save_coaching_instructions) without an extra DB round-trip.
      let currentProfile = profile;
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        let resultText = 'Done.';

        if (block.name === 'save_coaching_instructions') {
          if (!currentProfile) {
            resultText = 'Could not save instructions: no fitness profile found for this user yet.';
          } else {
            const result = await saveCoachingInstructionsAction(userId, currentProfile, block.input as {
              intensityModifier?: number;
              exerciseOverrides?: Record<string, { intensityModifier?: number; notes?: string }>;
              generalNotes?: string;
            });
            currentProfile = result.profile;
            resultText = result.resultText;
          }
        } else if (block.name === 'schedule_workout_plan') {
          if (!currentProfile) {
            resultText = 'Could not schedule workouts: no fitness profile found for this user yet.';
          } else {
            const result = await scheduleWorkoutPlanAction(userId, currentProfile, block.input as {
              split?: 'ppl' | 'upper_lower' | 'full_body' | 'bro_split';
              stepTarget?: number;
              cardioSessions?: { dayOffset: number; name: string; durationMinutes?: number; notes?: string }[];
            });
            currentProfile = result.profile;
            resultText = result.resultText;
          }
        } else if (block.name === 'set_nutrition_targets') {
          if (!currentProfile) {
            resultText = 'Could not set nutrition targets: no fitness profile found for this user yet.';
          } else {
            const result = await setNutritionTargetsAction(userId, currentProfile, block.input as { calories: number; protein?: number; carbs?: number; fat?: number; reason: string });
            currentProfile = result.profile;
            resultText = result.resultText;
          }
        } else if (block.name === 'set_ai_coach_goal') {
          if (!currentProfile) {
            resultText = 'Could not enable AI Coach Mode: no fitness profile found for this user yet.';
          } else {
            const result = await setAiCoachGoalAction(userId, currentProfile, block.input as { goalDescription: string });
            currentProfile = result.profile;
            resultText = result.resultText;
          }
        } else if (block.name === 'remember_insight') {
          const result = await rememberInsightAction(userId, block.input as { category: 'insight' | 'preference' | 'constraint' | 'outcome'; content: string });
          resultText = result.resultText;
        }

        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: resultText });
      }

      // Continue with a follow-up message that includes all tool results
      const messagesWithTool: Anthropic.MessageParam[] = [
        ...messages,
        { role: 'assistant' as const, content: toolResponse.content },
        { role: 'user' as const, content: toolResults },
      ];

      const followUp = client.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messagesWithTool,
      });

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          for await (const chunk of followUp) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
          controller.close();
        },
      });
      return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // No tool was called; stream the text response that was already generated
    const textContent = toolResponse.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('');

    return new Response(textContent, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // Normal streaming path (no persisted changes detected)
  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
