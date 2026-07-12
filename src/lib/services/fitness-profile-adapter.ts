import type { UserProfile, ActivityLevel, Goal, ExperienceLevel, WorkoutSplit } from '@/types';

export interface FitnessProfileRow {
  name: string;
  age: number;
  gender: string;
  heightCm: number;
  currentWeightLbs: number;
  targetWeightLbs: number;
  activityLevel: string;
  goal: string;
  experienceLevel: string;
  preferredSplit: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toCalcUserProfile(row: FitnessProfileRow): UserProfile {
  return {
    name: row.name,
    age: row.age,
    gender: row.gender as 'male' | 'female',
    heightCm: row.heightCm,
    currentWeightLbs: row.currentWeightLbs,
    targetWeightLbs: row.targetWeightLbs,
    activityLevel: row.activityLevel as ActivityLevel,
    goal: row.goal as Goal,
    experienceLevel: row.experienceLevel as ExperienceLevel,
    preferredSplit: row.preferredSplit as WorkoutSplit,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
