import type { DailyActivity, ActivityCategory } from '../types';
import { movingAverage } from '../utils';
import { categorizeActivity } from './macro-calculator';

export { categorizeActivity };

export interface ActivityInsight {
  averageSteps: number;
  averageActiveCalories: number;
  category: ActivityCategory;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercent: number;
  recommendation: string;
}

export function analyzeActivity(activities: DailyActivity[]): ActivityInsight {
  if (activities.length === 0) {
    return {
      averageSteps: 0,
      averageActiveCalories: 0,
      category: 'sedentary',
      trend: 'stable',
      trendPercent: 0,
      recommendation: 'Start logging your activity to get personalized insights.',
    };
  }

  const sorted = [...activities].sort((a, b) => a.date.localeCompare(b.date));
  const steps = sorted.map(a => a.steps);
  const activeCalories = sorted.map(a => a.activeCalories);

  const avgSteps = movingAverage(steps, 7);
  const avgCalories = movingAverage(activeCalories, 7);
  const category = categorizeActivity(avgSteps);

  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  let trendPercent = 0;

  if (steps.length >= 14) {
    const recentAvg = movingAverage(steps, 7);
    const previousAvg = movingAverage(steps.slice(0, -7), 7);
    trendPercent = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;

    if (trendPercent > 10) trend = 'increasing';
    else if (trendPercent < -10) trend = 'decreasing';
  }

  const recommendation = getActivityRecommendation(category, trend, avgSteps);

  return {
    averageSteps: Math.round(avgSteps),
    averageActiveCalories: Math.round(avgCalories),
    category,
    trend,
    trendPercent: Math.round(trendPercent),
    recommendation,
  };
}

function getActivityRecommendation(
  category: ActivityCategory,
  trend: string,
  avgSteps: number,
): string {
  if (category === 'sedentary') {
    return `Your average of ${Math.round(avgSteps).toLocaleString()} steps is below target. Try adding a 15-minute walk after meals to boost your daily movement and calorie burn.`;
  }

  if (category === 'light') {
    if (trend === 'decreasing') {
      return `Activity is trending down. Try to maintain at least 7,500 steps daily. Consider a morning walk or taking stairs.`;
    }
    return `Good start! Push for 7,500-10,000 steps daily to support your fat loss goals. Your TDEE will be adjusted upward as activity increases.`;
  }

  if (category === 'moderate') {
    return `Great activity level! ${Math.round(avgSteps).toLocaleString()} steps avg. This supports your calorie deficit well. Your nutrition targets reflect this activity.`;
  }

  if (trend === 'increasing') {
    return `Excellent activity! Make sure you're eating enough to fuel recovery. Your calorie targets have been adjusted for your high activity.`;
  }
  return `Outstanding activity level! Your high step count boosts your daily calorie burn significantly. Make sure recovery nutrition is on point.`;
}

export function shouldSuggestRestDay(
  activities: DailyActivity[],
  recentWorkoutCount: number,
): { suggest: boolean; reason: string } {
  if (activities.length < 3) {
    return { suggest: false, reason: '' };
  }

  const recent = activities.slice(-3);
  const avgActiveCalories = recent.reduce((sum, a) => sum + a.activeCalories, 0) / recent.length;
  const avgRestingHR = recent
    .filter(a => a.restingHeartRate)
    .reduce((sum, a) => sum + (a.restingHeartRate ?? 0), 0) / recent.filter(a => a.restingHeartRate).length;

  if (avgActiveCalories > 500 && recentWorkoutCount >= 4) {
    return {
      suggest: true,
      reason: 'High activity levels combined with frequent training. A rest day would help recovery.',
    };
  }

  if (avgRestingHR > 75 && recentWorkoutCount >= 3) {
    return {
      suggest: true,
      reason: 'Elevated resting heart rate detected. Consider a lighter day or rest day.',
    };
  }

  return { suggest: false, reason: '' };
}

export function getActivityCalorieAdjustment(
  todaySteps: number,
  averageSteps: number,
): number {
  const diff = todaySteps - averageSteps;

  if (diff > 3000) return 200;
  if (diff > 1500) return 100;
  if (diff < -3000) return -150;
  if (diff < -1500) return -75;
  return 0;
}
