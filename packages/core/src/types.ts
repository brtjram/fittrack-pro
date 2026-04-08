// ==================== User Profile ====================
export interface UserProfile {
  id?: string;
  name: string;
  age: number;
  gender: 'male' | 'female';
  heightCm: number;
  currentWeightLbs: number;
  targetWeightLbs: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  experienceLevel: ExperienceLevel;
  preferredSplit: WorkoutSplit;
  healthSyncApiKey?: string;
  createdAt: string;
  updatedAt: string;
}

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'fat_loss' | 'muscle_gain' | 'recomp' | 'maintain';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type WorkoutSplit = 'ppl' | 'upper_lower' | 'full_body' | 'bro_split';

// ==================== Workout Models ====================
export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'abs' | 'forearms';

export type Equipment = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight' | 'band';
export type ExerciseType = 'compound' | 'isolation';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  equipment: Equipment;
  type: ExerciseType;
  instructions: string;
}

export interface WorkoutSet {
  setNumber: number;
  targetReps: number;
  targetWeight: number;
  actualReps?: number;
  actualWeight?: number;
  rpe?: number;
  completed: boolean;
}

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSet[];
  restSeconds: number;
  notes?: string;
  isSuperset?: boolean;
  supersetWith?: string;
}

export interface WorkoutSession {
  id?: string;
  sessionId: string;
  date: string;
  name: string;
  splitDay: string;
  exercises: WorkoutExercise[];
  duration?: number;
  completed: boolean;
  weekNumber: number;
  isDeload: boolean;
  notes?: string;
}

export interface PersonalRecord {
  id?: string;
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  date: string;
  sessionId: string;
}

// ==================== Nutrition Models ====================
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type FoodCategory = 'protein' | 'carbs' | 'fat' | 'dairy' | 'fruit' | 'vegetable' | 'grain' | 'beverage' | 'snack' | 'supplement';

export interface FoodItem {
  id: string;
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g?: number;
  servingSizeG: number;
  servingLabel: string;
  category: FoodCategory;
}

export interface FoodLogEntry {
  id?: string;
  date: string;
  foodItemId: string;
  foodName: string;
  servings: number;
  servingSizeG: number;
  meal: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionAdjustment {
  id?: string;
  date: string;
  previousCalories: number;
  newCalories: number;
  reason: string;
  weeklyWeightChange: number;
}

// ==================== Supplements ====================
export type EvidenceLevel = 'strong' | 'moderate' | 'emerging';

export interface Supplement {
  id: string;
  name: string;
  dosage: string;
  timing: string;
  benefits: string[];
  evidenceLevel: EvidenceLevel;
  category: 'core' | 'fat_loss' | 'recovery' | 'health';
  goals: Goal[];
  contraindications?: string[];
  notes?: string;
}

// ==================== Weight & Analytics ====================
export interface WeightEntry {
  id?: string;
  date: string;
  weightLbs: number;
  bodyFatPercent?: number;
  note?: string;
}

export interface DailyActivity {
  id?: string;
  date: string;
  steps: number;
  activeCalories: number;
  restingHeartRate?: number;
  source: 'apple_health' | 'manual';
}

export type ActivityCategory = 'sedentary' | 'light' | 'moderate' | 'active';

// ==================== Workout Templates ====================
export interface WorkoutTemplate {
  name: string;
  splitDay: string;
  exercises: {
    exerciseId: string;
    sets: number;
    reps: number;
    restSeconds: number;
    isSuperset?: boolean;
    supersetWith?: string;
  }[];
}

export interface WorkoutPlan {
  split: WorkoutSplit;
  daysPerWeek: number;
  templates: WorkoutTemplate[];
}
