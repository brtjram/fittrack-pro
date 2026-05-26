import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAuthUserId } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

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

interface CoachingNotes {
  intensityModifier?: number;
  exerciseOverrides?: Record<string, { intensityModifier?: number; notes?: string }>;
  generalNotes?: string;
  lastUpdated?: string;
}

function formatCoachingNotes(notes: CoachingNotes): string {
  const parts: string[] = [];
  if (notes.intensityModifier && notes.intensityModifier !== 1.0) {
    const pct = Math.round((notes.intensityModifier - 1) * 100);
    parts.push(`Overall intensity: ${pct > 0 ? '+' : ''}${pct}% on all lifts`);
  }
  if (notes.generalNotes) parts.push(notes.generalNotes);
  if (notes.exerciseOverrides) {
    for (const [exercise, override] of Object.entries(notes.exerciseOverrides)) {
      const parts2: string[] = [];
      if (override.intensityModifier && override.intensityModifier !== 1.0) {
        const pct = Math.round((override.intensityModifier - 1) * 100);
        parts2.push(`${pct > 0 ? '+' : ''}${pct}% load`);
      }
      if (override.notes) parts2.push(override.notes);
      if (parts2.length) parts.push(`${exercise}: ${parts2.join(', ')}`);
    }
  }
  return parts.join('\n- ');
}

const saveCoachingInstructionsTool: Anthropic.Tool = {
  name: 'save_coaching_instructions',
  description: 'Save training or nutrition instructions given by the user so they persist and affect future workouts and meal plans. Use this whenever the user explicitly asks to change workout intensity, load, exercise difficulty, or dietary preferences.',
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
        description: 'Free-text coaching preferences (e.g., "more leg volume", "swap deadlifts for RDLs", "keep calories at 2200").',
      },
    },
    required: [],
  },
};

export async function POST(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const { messages } = await request.json() as { messages: { role: 'user' | 'assistant'; content: string }[] };

  const [profile, challenge] = await Promise.all([
    prisma.fitnessProfile.findUnique({ where: { userId } }),
    prisma.transformationChallenge.findUnique({ where: { userId } }),
  ]);

  let systemPrompt = `You are a knowledgeable personal trainer and nutrition coach inside FitTrack Pro. Be concise, practical, and encouraging. Answer questions about workouts, nutrition, recovery, and fitness goals.

IMPORTANT: When the user asks you to change workout intensity (make it harder/easier), adjust loads for specific exercises, or modify their diet/nutrition targets, ALWAYS use the save_coaching_instructions tool to persist those changes. These saved instructions will automatically feed into their generated workouts and nutrition plans going forward. Confirm to the user that you've saved their preferences.`;

  if (profile) {
    systemPrompt += `\n\nUser profile: ${profile.name}, ${profile.age}yo ${profile.gender}, ${profile.currentWeightLbs}lbs, goal: ${profile.goal}, experience: ${profile.experienceLevel}, split: ${profile.preferredSplit}.`;

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

  // First pass: check if this message contains coaching instructions
  const lastUserMessage = messages[messages.length - 1];
  const mightHaveInstructions = lastUserMessage?.role === 'user' &&
    /\b(intense|intensity|harder|heavier|lighter|easier|reduce|increase|lower|higher|less|more|change|adjust|modify|swap|replace|drop|add|switch|cut|maintain|focus|avoid|skip)\b/i.test(lastUserMessage.content);

  if (mightHaveInstructions) {
    // Run with tools to potentially save instructions
    const toolResponse = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools: [saveCoachingInstructionsTool],
      tool_choice: { type: 'auto' },
    });

    // Process tool use
    for (const block of toolResponse.content) {
      if (block.type === 'tool_use' && block.name === 'save_coaching_instructions') {
        const input = block.input as {
          intensityModifier?: number;
          exerciseOverrides?: Record<string, { intensityModifier?: number; notes?: string }>;
          generalNotes?: string;
        };

        let existing: CoachingNotes = {};
        if (profile?.coachingNotes) {
          try { existing = JSON.parse(profile.coachingNotes); } catch { /* ignore */ }
        }

        const merged: CoachingNotes = {
          ...existing,
          ...(input.intensityModifier !== undefined && { intensityModifier: input.intensityModifier }),
          ...(input.generalNotes && { generalNotes: [existing.generalNotes, input.generalNotes].filter(Boolean).join('. ') }),
          exerciseOverrides: {
            ...existing.exerciseOverrides,
            ...input.exerciseOverrides,
          },
          lastUpdated: new Date().toISOString().split('T')[0],
        };

        await prisma.fitnessProfile.updateMany({
          where: { userId },
          data: { coachingNotes: JSON.stringify(merged) },
        });

        // Continue with a follow-up message that includes the tool result
        const messagesWithTool: Anthropic.MessageParam[] = [
          ...messages,
          { role: 'assistant' as const, content: toolResponse.content },
          {
            role: 'user' as const,
            content: [{
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: 'Instructions saved successfully. These will now affect future workout generation and nutrition plans.',
            }],
          },
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
    }

    // No tool was called; stream the text response that was already generated
    const textContent = toolResponse.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('');

    return new Response(textContent, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // Normal streaming path (no coaching instructions detected)
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
