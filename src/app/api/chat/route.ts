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

export async function POST(request: NextRequest) {
  const userId = await getAuthUserId();
  if (userId instanceof NextResponse) return userId;

  const { messages } = await request.json() as { messages: { role: 'user' | 'assistant'; content: string }[] };

  const profile = await prisma.fitnessProfile.findUnique({ where: { userId } });

  let systemPrompt = `You are a knowledgeable personal trainer and nutrition coach inside FitTrack Pro. Be concise, practical, and encouraging. Answer questions about workouts, nutrition, recovery, and fitness goals.`;

  if (profile) {
    systemPrompt += `\n\nUser profile: ${profile.name}, ${profile.age}yo ${profile.gender}, ${profile.currentWeightLbs}lbs, goal: ${profile.goal}, experience: ${profile.experienceLevel}, split: ${profile.preferredSplit}.`;
    if (profile.trackCycle && profile.lastPeriodDate && profile.cycleLength) {
      systemPrompt += `\n\nMenstrual cycle: ${getCyclePhase(profile.lastPeriodDate, profile.cycleLength)}. Factor this into training and recovery recommendations.`;
    }
  }

  const stream = await client.messages.stream({
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
