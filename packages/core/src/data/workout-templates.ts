import type { WorkoutPlan, WorkoutTemplate } from '../types';

const pplTemplates: WorkoutTemplate[] = [
  {
    name: 'Push Day A',
    splitDay: 'push-a',
    exercises: [
      { exerciseId: 'bench-press', sets: 4, reps: 8, restSeconds: 120 },
      { exerciseId: 'incline-db-press', sets: 3, reps: 10, restSeconds: 90 },
      { exerciseId: 'ohp', sets: 3, reps: 10, restSeconds: 90 },
      { exerciseId: 'lateral-raise', sets: 3, reps: 15, restSeconds: 60 },
      { exerciseId: 'tricep-pushdown', sets: 3, reps: 12, restSeconds: 60 },
      { exerciseId: 'overhead-extension', sets: 3, reps: 12, restSeconds: 60 },
    ],
  },
  {
    name: 'Pull Day A',
    splitDay: 'pull-a',
    exercises: [
      { exerciseId: 'barbell-row', sets: 4, reps: 8, restSeconds: 120 },
      { exerciseId: 'lat-pulldown', sets: 3, reps: 10, restSeconds: 90 },
      { exerciseId: 'cable-row', sets: 3, reps: 10, restSeconds: 90 },
      { exerciseId: 'face-pull', sets: 3, reps: 15, restSeconds: 60 },
      { exerciseId: 'barbell-curl', sets: 3, reps: 10, restSeconds: 60 },
      { exerciseId: 'hammer-curl', sets: 3, reps: 12, restSeconds: 60 },
    ],
  },
  {
    name: 'Legs Day A',
    splitDay: 'legs-a',
    exercises: [
      { exerciseId: 'squat', sets: 4, reps: 8, restSeconds: 150 },
      { exerciseId: 'rdl', sets: 3, reps: 10, restSeconds: 120 },
      { exerciseId: 'leg-press', sets: 3, reps: 12, restSeconds: 90 },
      { exerciseId: 'leg-curl', sets: 3, reps: 12, restSeconds: 60 },
      { exerciseId: 'leg-extension', sets: 3, reps: 12, restSeconds: 60 },
      { exerciseId: 'standing-calf-raise', sets: 4, reps: 15, restSeconds: 60 },
    ],
  },
  {
    name: 'Push Day B',
    splitDay: 'push-b',
    exercises: [
      { exerciseId: 'db-bench-press', sets: 4, reps: 10, restSeconds: 90 },
      { exerciseId: 'machine-chest-press', sets: 3, reps: 12, restSeconds: 90 },
      { exerciseId: 'arnold-press', sets: 3, reps: 10, restSeconds: 90 },
      { exerciseId: 'cable-crossover', sets: 3, reps: 12, restSeconds: 60 },
      { exerciseId: 'lateral-raise', sets: 4, reps: 15, restSeconds: 60 },
      { exerciseId: 'rope-pushdown', sets: 3, reps: 12, restSeconds: 60 },
    ],
  },
  {
    name: 'Pull Day B',
    splitDay: 'pull-b',
    exercises: [
      { exerciseId: 'pull-up', sets: 4, reps: 8, restSeconds: 120 },
      { exerciseId: 'db-row', sets: 3, reps: 10, restSeconds: 90 },
      { exerciseId: 'straight-arm-pulldown', sets: 3, reps: 12, restSeconds: 60 },
      { exerciseId: 'reverse-fly', sets: 3, reps: 15, restSeconds: 60 },
      { exerciseId: 'incline-curl', sets: 3, reps: 12, restSeconds: 60 },
      { exerciseId: 'cable-curl', sets: 3, reps: 12, restSeconds: 60 },
    ],
  },
  {
    name: 'Legs Day B',
    splitDay: 'legs-b',
    exercises: [
      { exerciseId: 'front-squat', sets: 4, reps: 8, restSeconds: 150 },
      { exerciseId: 'hip-thrust', sets: 3, reps: 10, restSeconds: 120 },
      { exerciseId: 'bulgarian-split', sets: 3, reps: 10, restSeconds: 90 },
      { exerciseId: 'seated-leg-curl', sets: 3, reps: 12, restSeconds: 60 },
      { exerciseId: 'leg-extension', sets: 3, reps: 12, restSeconds: 60 },
      { exerciseId: 'seated-calf-raise', sets: 4, reps: 15, restSeconds: 60 },
    ],
  },
];

const upperLowerTemplates: WorkoutTemplate[] = [
  {
    name: 'Upper Body A',
    splitDay: 'upper-a',
    exercises: [
      { exerciseId: 'bench-press', sets: 4, reps: 8, restSeconds: 120 },
      { exerciseId: 'barbell-row', sets: 4, reps: 8, restSeconds: 120 },
      { exerciseId: 'ohp', sets: 3, reps: 10, restSeconds: 90 },
      { exerciseId: 'lat-pulldown', sets: 3, reps: 10, restSeconds: 90 },
      { exerciseId: 'lateral-raise', sets: 3, reps: 15, restSeconds: 60 },
      { exerciseId: 'barbell-curl', sets: 3, reps: 10, restSeconds: 60 },
      { exerciseId: 'tricep-pushdown', sets: 3, reps: 12, restSeconds: 60 },
    ],
  },
  {
    name: 'Lower Body A',
    splitDay: 'lower-a',
    exercises: [
      { exerciseId: 'squat', sets: 4, reps: 8, restSeconds: 150 },
      { exerciseId: 'rdl', sets: 3, reps: 10, restSeconds: 120 },
      { exerciseId: 'leg-press', sets: 3, reps: 12, restSeconds: 90 },
      { exerciseId: 'leg-curl', sets: 3, reps: 12, restSeconds: 60 },
      { exerciseId: 'standing-calf-raise', sets: 4, reps: 15, restSeconds: 60 },
      { exerciseId: 'hanging-leg-raise', sets: 3, reps: 15, restSeconds: 60 },
    ],
  },
  {
    name: 'Upper Body B',
    splitDay: 'upper-b',
    exercises: [
      { exerciseId: 'db-bench-press', sets: 4, reps: 10, restSeconds: 90 },
      { exerciseId: 'cable-row', sets: 4, reps: 10, restSeconds: 90 },
      { exerciseId: 'db-shoulder-press', sets: 3, reps: 10, restSeconds: 90 },
      { exerciseId: 'pull-up', sets: 3, reps: 8, restSeconds: 90 },
      { exerciseId: 'face-pull', sets: 3, reps: 15, restSeconds: 60 },
      { exerciseId: 'hammer-curl', sets: 3, reps: 12, restSeconds: 60 },
      { exerciseId: 'overhead-extension', sets: 3, reps: 12, restSeconds: 60 },
    ],
  },
  {
    name: 'Lower Body B',
    splitDay: 'lower-b',
    exercises: [
      { exerciseId: 'deadlift', sets: 4, reps: 6, restSeconds: 180 },
      { exerciseId: 'bulgarian-split', sets: 3, reps: 10, restSeconds: 90 },
      { exerciseId: 'hip-thrust', sets: 3, reps: 10, restSeconds: 90 },
      { exerciseId: 'leg-extension', sets: 3, reps: 12, restSeconds: 60 },
      { exerciseId: 'seated-calf-raise', sets: 4, reps: 15, restSeconds: 60 },
      { exerciseId: 'cable-crunch', sets: 3, reps: 15, restSeconds: 60 },
    ],
  },
];

const fullBodyTemplates: WorkoutTemplate[] = [
  {
    name: 'Full Body A',
    splitDay: 'full-a',
    exercises: [
      { exerciseId: 'squat', sets: 4, reps: 8, restSeconds: 150 },
      { exerciseId: 'bench-press', sets: 4, reps: 8, restSeconds: 120 },
      { exerciseId: 'barbell-row', sets: 4, reps: 8, restSeconds: 120 },
      { exerciseId: 'rdl', sets: 3, reps: 10, restSeconds: 90 },
      { exerciseId: 'lateral-raise', sets: 3, reps: 15, restSeconds: 60 },
      { exerciseId: 'barbell-curl', sets: 2, reps: 12, restSeconds: 60 },
      { exerciseId: 'tricep-pushdown', sets: 2, reps: 12, restSeconds: 60 },
    ],
  },
  {
    name: 'Full Body B',
    splitDay: 'full-b',
    exercises: [
      { exerciseId: 'deadlift', sets: 4, reps: 6, restSeconds: 180 },
      { exerciseId: 'ohp', sets: 4, reps: 8, restSeconds: 120 },
      { exerciseId: 'pull-up', sets: 4, reps: 8, restSeconds: 120 },
      { exerciseId: 'leg-press', sets: 3, reps: 12, restSeconds: 90 },
      { exerciseId: 'db-fly', sets: 3, reps: 12, restSeconds: 60 },
      { exerciseId: 'hammer-curl', sets: 2, reps: 12, restSeconds: 60 },
      { exerciseId: 'rope-pushdown', sets: 2, reps: 12, restSeconds: 60 },
    ],
  },
  {
    name: 'Full Body C',
    splitDay: 'full-c',
    exercises: [
      { exerciseId: 'front-squat', sets: 4, reps: 8, restSeconds: 150 },
      { exerciseId: 'incline-db-press', sets: 4, reps: 10, restSeconds: 90 },
      { exerciseId: 'db-row', sets: 4, reps: 10, restSeconds: 90 },
      { exerciseId: 'hip-thrust', sets: 3, reps: 10, restSeconds: 90 },
      { exerciseId: 'face-pull', sets: 3, reps: 15, restSeconds: 60 },
      { exerciseId: 'cable-curl', sets: 2, reps: 12, restSeconds: 60 },
      { exerciseId: 'overhead-extension', sets: 2, reps: 12, restSeconds: 60 },
    ],
  },
];

const broSplitTemplates: WorkoutTemplate[] = [
  {
    name: 'Chest Day',
    splitDay: 'chest',
    exercises: [
      { exerciseId: 'bench-press', sets: 4, reps: 8, restSeconds: 120 },
      { exerciseId: 'incline-db-press', sets: 4, reps: 10, restSeconds: 90 },
      { exerciseId: 'db-fly', sets: 3, reps: 12, restSeconds: 60 },
      { exerciseId: 'cable-crossover', sets: 3, reps: 15, restSeconds: 60 },
      { exerciseId: 'push-up', sets: 3, reps: 15, restSeconds: 60 },
    ],
  },
  {
    name: 'Back Day',
    splitDay: 'back',
    exercises: [
      { exerciseId: 'deadlift', sets: 4, reps: 6, restSeconds: 180 },
      { exerciseId: 'barbell-row', sets: 4, reps: 8, restSeconds: 120 },
      { exerciseId: 'lat-pulldown', sets: 3, reps: 10, restSeconds: 90 },
      { exerciseId: 'cable-row', sets: 3, reps: 10, restSeconds: 90 },
      { exerciseId: 'face-pull', sets: 3, reps: 15, restSeconds: 60 },
    ],
  },
  {
    name: 'Shoulders Day',
    splitDay: 'shoulders',
    exercises: [
      { exerciseId: 'ohp', sets: 4, reps: 8, restSeconds: 120 },
      { exerciseId: 'arnold-press', sets: 3, reps: 10, restSeconds: 90 },
      { exerciseId: 'lateral-raise', sets: 4, reps: 15, restSeconds: 60 },
      { exerciseId: 'reverse-fly', sets: 3, reps: 15, restSeconds: 60 },
      { exerciseId: 'upright-row', sets: 3, reps: 12, restSeconds: 60 },
    ],
  },
  {
    name: 'Legs Day',
    splitDay: 'legs',
    exercises: [
      { exerciseId: 'squat', sets: 4, reps: 8, restSeconds: 150 },
      { exerciseId: 'rdl', sets: 3, reps: 10, restSeconds: 120 },
      { exerciseId: 'leg-press', sets: 3, reps: 12, restSeconds: 90 },
      { exerciseId: 'leg-curl', sets: 3, reps: 12, restSeconds: 60 },
      { exerciseId: 'leg-extension', sets: 3, reps: 12, restSeconds: 60 },
      { exerciseId: 'standing-calf-raise', sets: 4, reps: 15, restSeconds: 60 },
    ],
  },
  {
    name: 'Arms Day',
    splitDay: 'arms',
    exercises: [
      { exerciseId: 'barbell-curl', sets: 4, reps: 10, restSeconds: 60 },
      { exerciseId: 'close-grip-bench', sets: 4, reps: 10, restSeconds: 90 },
      { exerciseId: 'hammer-curl', sets: 3, reps: 12, restSeconds: 60 },
      { exerciseId: 'skull-crusher', sets: 3, reps: 12, restSeconds: 60 },
      { exerciseId: 'cable-curl', sets: 3, reps: 15, restSeconds: 60 },
      { exerciseId: 'rope-pushdown', sets: 3, reps: 15, restSeconds: 60 },
    ],
  },
];

export const workoutPlans: Record<string, WorkoutPlan> = {
  ppl: {
    split: 'ppl',
    daysPerWeek: 6,
    templates: pplTemplates,
  },
  upper_lower: {
    split: 'upper_lower',
    daysPerWeek: 4,
    templates: upperLowerTemplates,
  },
  full_body: {
    split: 'full_body',
    daysPerWeek: 3,
    templates: fullBodyTemplates,
  },
  bro_split: {
    split: 'bro_split',
    daysPerWeek: 5,
    templates: broSplitTemplates,
  },
};

export function getWorkoutPlan(split: string): WorkoutPlan | undefined {
  return workoutPlans[split];
}

export function getNextWorkoutTemplate(split: string, lastSplitDay?: string): WorkoutTemplate | undefined {
  const plan = workoutPlans[split];
  if (!plan) return undefined;

  if (!lastSplitDay) return plan.templates[0];

  const currentIndex = plan.templates.findIndex(t => t.splitDay === lastSplitDay);
  const nextIndex = (currentIndex + 1) % plan.templates.length;
  return plan.templates[nextIndex];
}
