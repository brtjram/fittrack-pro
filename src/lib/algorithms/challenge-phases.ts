// Web's view of the 12-Week Transformation Challenge's phases: the phase numbers
// and copy live once in @fittrack/core (shared with mobile so they can't drift),
// this file just layers Tailwind classes on top by color name.

import {
  CHALLENGE_PHASES as CORE_CHALLENGE_PHASES,
  getChallengePhase as coreGetChallengePhase,
  getChallengeWeekTargets as coreGetChallengeWeekTargets,
  type ChallengePhase as CoreChallengePhase,
  type ChallengePhaseColor,
} from '@fittrack/core';

export type { ChallengePhaseTargets } from '@fittrack/core';

export interface ChallengePhase extends CoreChallengePhase {
  bgClass: string;
  textClass: string;
  barClass: string;
}

const STYLE_BY_COLOR: Record<ChallengePhaseColor, Pick<ChallengePhase, 'bgClass' | 'textClass' | 'barClass'>> = {
  blue: { bgClass: 'bg-blue-500/10 border-blue-500/30', textClass: 'text-blue-500', barClass: 'bg-blue-500' },
  amber: { bgClass: 'bg-amber-500/10 border-amber-500/30', textClass: 'text-amber-500', barClass: 'bg-amber-500' },
  red: { bgClass: 'bg-red-500/10 border-red-500/30', textClass: 'text-red-500', barClass: 'bg-red-500' },
};

function withStyle(phase: CoreChallengePhase): ChallengePhase {
  return { ...phase, ...STYLE_BY_COLOR[phase.color] };
}

export const CHALLENGE_PHASES: ChallengePhase[] = CORE_CHALLENGE_PHASES.map(withStyle);

export function getChallengePhase(week: number): ChallengePhase {
  return withStyle(coreGetChallengePhase(week));
}

export function getChallengeWeekTargets(week: number, startWeight: number, targetWeight: number) {
  return coreGetChallengeWeekTargets(week, startWeight, targetWeight);
}
