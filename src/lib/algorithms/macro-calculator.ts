import type { UserProfile, MacroTargets, WeightEntry, DailyActivity, ActivityCategory } from '@/types';
import { movingAverage } from '@/lib/utils';

// Activity multipliers for Mifflin-St Jeor
const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Goal-based calorie adjustments
const GOAL_ADJUSTMENTS = {
  fat_loss: -0.22, // 22% deficit
  muscle_gain: 0.15, // 15% surplus
  recomp: -0.05, // Slight deficit
  maintain: 0,
  // AI coach mode: no fixed adjustment — the coach sets a nutritionTargetOverride
  // based on the user's stated goal, which is checked before this map is used.
  // 0 is only a fallback for the window before the coach has set a target.
  ai_coach: 0,
};

const PROTEIN_PER_KG = 2.2; // g/kg for muscle preservation during cut
const LBS_TO_KG = 0.453592;
const FAT_CALORIE_PERCENT = 0.25; // 25% of calories from fat
const CALORIES_PER_G_PROTEIN = 4;
const CALORIES_PER_G_CARB = 4;
const CALORIES_PER_G_FAT = 9;

export function calculateBMR(profile: UserProfile): number {
  // Mifflin-St Jeor equation (needs kg internally)
  const weightKg = profile.currentWeightLbs * LBS_TO_KG;
  const base = 10 * weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  return profile.gender === 'male' ? base + 5 : base - 161;
}

export function calculateTDEE(profile: UserProfile): number {
  const bmr = calculateBMR(profile);
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[profile.activityLevel]);
}

export function calculateMacroTargets(profile: UserProfile): MacroTargets {
  if (profile.nutritionTargetOverride) {
    try {
      const override = JSON.parse(profile.nutritionTargetOverride) as Partial<MacroTargets>;
      if (typeof override.calories === 'number') {
        return {
          calories: override.calories,
          protein: override.protein ?? 0,
          carbs: override.carbs ?? 0,
          fat: override.fat ?? 0,
        };
      }
    } catch {
      // ignore parse errors, fall through to calculated targets
    }
  }

  const tdee = calculateTDEE(profile);
  const goalAdjustment = GOAL_ADJUSTMENTS[profile.goal];
  const targetCalories = Math.round(tdee * (1 + goalAdjustment));

  // Protein: 2.2g/kg bodyweight (convert lbs to kg)
  const weightKg = profile.currentWeightLbs * LBS_TO_KG;
  const protein = Math.round(PROTEIN_PER_KG * weightKg);

  // Fat: 25% of total calories
  const fat = Math.round((targetCalories * FAT_CALORIE_PERCENT) / CALORIES_PER_G_FAT);

  // Carbs: remainder
  const proteinCalories = protein * CALORIES_PER_G_PROTEIN;
  const fatCalories = fat * CALORIES_PER_G_FAT;
  const carbs = Math.round((targetCalories - proteinCalories - fatCalories) / CALORIES_PER_G_CARB);

  return {
    calories: targetCalories,
    protein,
    carbs: Math.max(carbs, 50), // Minimum 50g carbs
    fat,
  };
}

export interface AdaptiveAdjustment {
  newCalories: number;
  adjustment: number;
  reason: string;
  shouldAdjust: boolean;
}

export function calculateAdaptiveAdjustment(
  currentCalories: number,
  weightEntries: WeightEntry[],
  goal: string,
): AdaptiveAdjustment {
  if (weightEntries.length < 14) {
    return {
      newCalories: currentCalories,
      adjustment: 0,
      reason: 'Need at least 2 weeks of weight data for adaptive adjustment.',
      shouldAdjust: false,
    };
  }

  // Sort by date
  const sorted = [...weightEntries].sort((a, b) => a.date.localeCompare(b.date));
  const weights = sorted.map(w => w.weightLbs);

  // Calculate 7-day moving averages
  const currentWeekAvg = movingAverage(weights, 7);
  const previousWeekAvg = movingAverage(weights.slice(0, -7), 7);
  const weeklyChange = currentWeekAvg - previousWeekAvg;

  if (goal === 'fat_loss') {
    // Target: 0.5-0.7% body weight per week (approx 1-1.5 lbs for most)
    if (weeklyChange > -0.5) {
      // Weight not dropping fast enough or stalled
      const twoWeekChange = weights.length >= 21
        ? movingAverage(weights, 7) - movingAverage(weights.slice(0, -14), 7)
        : weeklyChange * 2;

      if (Math.abs(twoWeekChange) < 0.7) {
        // Stalled for 2+ weeks
        return {
          newCalories: currentCalories - 200,
          adjustment: -200,
          reason: `Weight stalled for 2+ weeks (${weeklyChange > 0 ? '+' : ''}${weeklyChange.toFixed(1)} lbs/wk). Reducing by 200 calories.`,
          shouldAdjust: true,
        };
      }
      return {
        newCalories: currentCalories - 100,
        adjustment: -100,
        reason: `Weight loss too slow (${weeklyChange.toFixed(1)} lbs/wk). Reducing by 100 calories.`,
        shouldAdjust: true,
      };
    }

    if (weeklyChange < -2.2) {
      // Losing too fast - risk of muscle loss
      return {
        newCalories: currentCalories + 150,
        adjustment: 150,
        reason: `Weight dropping too fast (${weeklyChange.toFixed(1)} lbs/wk). Increasing by 150 calories to preserve muscle.`,
        shouldAdjust: true,
      };
    }

    // On track
    return {
      newCalories: currentCalories,
      adjustment: 0,
      reason: `On track! Losing ${Math.abs(weeklyChange).toFixed(1)} lbs/week (target: 0.7-1.5 lbs/wk).`,
      shouldAdjust: false,
    };
  }

  if (goal === 'muscle_gain') {
    if (weeklyChange < 0.2) {
      return {
        newCalories: currentCalories + 150,
        adjustment: 150,
        reason: `Not gaining enough (${weeklyChange.toFixed(1)} lbs/wk). Increasing by 150 calories.`,
        shouldAdjust: true,
      };
    }
    if (weeklyChange > 1.1) {
      return {
        newCalories: currentCalories - 100,
        adjustment: -100,
        reason: `Gaining too fast (${weeklyChange.toFixed(1)} lbs/wk). Reducing by 100 to minimize fat gain.`,
        shouldAdjust: true,
      };
    }
  }

  return {
    newCalories: currentCalories,
    adjustment: 0,
    reason: 'Progress is on track. No adjustment needed.',
    shouldAdjust: false,
  };
}

export function getActivityAdjustedCalories(
  baseCalories: number,
  activities: DailyActivity[],
  assumedActivityLevel: string,
): number {
  if (activities.length === 0) return baseCalories;

  const avgSteps = movingAverage(activities.map(a => a.steps), 7);
  const activityCategory = categorizeActivity(avgSteps);

  // If actual activity is significantly different from assumed, adjust
  const activityMap: Record<string, number> = {
    sedentary: 0,
    light: 1,
    moderate: 2,
    active: 3,
  };
  const assumedMap: Record<string, number> = {
    sedentary: 0,
    light: 1,
    moderate: 2,
    active: 3,
    very_active: 4,
  };

  const diff = activityMap[activityCategory] - (assumedMap[assumedActivityLevel] ?? 2);

  if (diff > 0) {
    // More active than assumed - add calories
    return baseCalories + diff * 100;
  } else if (diff < 0) {
    // Less active than assumed - reduce calories
    return baseCalories + diff * 75;
  }

  return baseCalories;
}

export function categorizeActivity(steps: number): ActivityCategory {
  if (steps < 5000) return 'sedentary';
  if (steps < 7500) return 'light';
  if (steps < 10000) return 'moderate';
  return 'active';
}

export function adjustMacrosForCalories(baseMacros: MacroTargets, newCalories: number): MacroTargets {
  // Keep protein the same, adjust carbs and fat proportionally
  const proteinCalories = baseMacros.protein * CALORIES_PER_G_PROTEIN;
  const remaining = newCalories - proteinCalories;
  const fat = Math.round((remaining * 0.35) / CALORIES_PER_G_FAT);
  const carbs = Math.round((remaining - fat * CALORIES_PER_G_FAT) / CALORIES_PER_G_CARB);

  return {
    calories: newCalories,
    protein: baseMacros.protein,
    carbs: Math.max(carbs, 50),
    fat: Math.max(fat, 30),
  };
}
