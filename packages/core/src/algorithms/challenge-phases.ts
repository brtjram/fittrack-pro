// Single source of truth for the 12-Week Transformation Challenge's 3 phases,
// shared by web and mobile so their phase targets/copy never drift from each
// other. Platform-specific styling (Tailwind classes on web, hex colors on
// mobile) is layered on top of `color` by each app, not stored here.

export interface ChallengePhaseTargets {
  steps: number;
  calorieDeficit: number;
  workoutsPerWeek: number;
  complianceDays: number;
}

export type ChallengePhaseColor = 'blue' | 'amber' | 'red';

export interface ChallengePhase {
  phase: 1 | 2 | 3;
  weeks: string;
  label: string;
  desc: string;
  color: ChallengePhaseColor;
  targets: ChallengePhaseTargets;
}

export const CHALLENGE_PHASES: ChallengePhase[] = [
  {
    phase: 1, weeks: '1–4', label: 'Foundation',
    desc: 'Establish habits. Moderate deficit (~300 cal). Build workout consistency. Hit your step target every day.',
    color: 'blue',
    targets: { steps: 9000, calorieDeficit: 300, workoutsPerWeek: 4, complianceDays: 5 },
  },
  {
    phase: 2, weeks: '5–8', label: 'Acceleration',
    desc: 'Tighten the diet (~400 cal deficit). Increase NEAT. Bump training intensity. Weekly weigh-ins are critical.',
    color: 'amber',
    targets: { steps: 11000, calorieDeficit: 400, workoutsPerWeek: 5, complianceDays: 6 },
  },
  {
    phase: 3, weeks: '9–12', label: 'Peak',
    desc: 'Aggressive deficit (~500 cal). Maximum intensity. Preserve muscle with heavy compounds. Push through the finish line.',
    color: 'red',
    targets: { steps: 12000, calorieDeficit: 500, workoutsPerWeek: 5, complianceDays: 6 },
  },
];

export function getChallengePhase(week: number): ChallengePhase {
  if (week <= 4) return CHALLENGE_PHASES[0];
  if (week <= 8) return CHALLENGE_PHASES[1];
  return CHALLENGE_PHASES[2];
}

export function getChallengeWeekTargets(week: number, startWeight: number, targetWeight: number) {
  const phase = getChallengePhase(week);
  const totalLoss = startWeight - targetWeight;
  const weeklyLoss = totalLoss / 12;
  const expectedWeight = Math.round((startWeight - weeklyLoss * (week - 1)) * 10) / 10;
  return { ...phase.targets, expectedWeight };
}
