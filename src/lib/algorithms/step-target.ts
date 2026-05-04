import type { ActivityLevel, Goal } from '@/types';

// Base steps reflect real NEAT output for each activity tier
const BASE: Record<ActivityLevel, number> = {
  sedentary: 5000,
  light:     7500,
  moderate:  10000,
  active:    12500,
  very_active: 15000,
};

// Fat loss needs extra NEAT; muscle gain doesn't benefit from high step counts
const GOAL_DELTA: Record<Goal, number> = {
  fat_loss:    2500,
  recomp:      1000,
  maintain:    0,
  muscle_gain: -1000,
};

export function computeStepTarget(activityLevel: ActivityLevel, goal: Goal): number {
  const raw = BASE[activityLevel] + GOAL_DELTA[goal];
  // Clamp to sensible range and round to nearest 500
  return Math.round(Math.max(3000, Math.min(20000, raw)) / 500) * 500;
}

export function stepTargetRationale(activityLevel: ActivityLevel, goal: Goal): string {
  const steps = computeStepTarget(activityLevel, goal);
  const lines: string[] = [];
  if (goal === 'fat_loss')    lines.push('extra NEAT from steps accelerates fat loss without impacting recovery');
  if (goal === 'muscle_gain') lines.push('lower step target preserves energy for muscle-building workouts');
  if (goal === 'recomp')      lines.push('moderate NEAT supports fat loss while maintaining training capacity');
  const base = `${steps.toLocaleString()} steps/day`;
  return lines.length ? `${base} — ${lines[0]}` : base;
}
