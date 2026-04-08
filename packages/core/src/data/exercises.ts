import type { Exercise } from '../types';

export const exercises: Exercise[] = [
  // ==================== CHEST ====================
  { id: 'bench-press', name: 'Barbell Bench Press', muscleGroup: 'chest', secondaryMuscles: ['triceps', 'shoulders'], equipment: 'barbell', type: 'compound', instructions: 'Lie on bench, grip bar slightly wider than shoulder width, lower to chest, press up.' },
  { id: 'incline-bench', name: 'Incline Barbell Bench Press', muscleGroup: 'chest', secondaryMuscles: ['shoulders', 'triceps'], equipment: 'barbell', type: 'compound', instructions: 'Set bench to 30-45 degrees, press bar from upper chest.' },
  { id: 'db-bench-press', name: 'Dumbbell Bench Press', muscleGroup: 'chest', secondaryMuscles: ['triceps', 'shoulders'], equipment: 'dumbbell', type: 'compound', instructions: 'Lie flat, press dumbbells from chest level to lockout.' },
  { id: 'incline-db-press', name: 'Incline Dumbbell Press', muscleGroup: 'chest', secondaryMuscles: ['shoulders', 'triceps'], equipment: 'dumbbell', type: 'compound', instructions: 'Set bench to 30-45 degrees, press dumbbells up.' },
  { id: 'db-fly', name: 'Dumbbell Fly', muscleGroup: 'chest', equipment: 'dumbbell', type: 'isolation', instructions: 'Lie flat, arms extended, lower dumbbells in arc to sides, squeeze back up.' },
  { id: 'cable-crossover', name: 'Cable Crossover', muscleGroup: 'chest', equipment: 'cable', type: 'isolation', instructions: 'Stand between cables, bring handles together in front of chest.' },
  { id: 'machine-chest-press', name: 'Machine Chest Press', muscleGroup: 'chest', secondaryMuscles: ['triceps'], equipment: 'machine', type: 'compound', instructions: 'Sit in machine, press handles forward to full extension.' },
  { id: 'pec-deck', name: 'Pec Deck Fly', muscleGroup: 'chest', equipment: 'machine', type: 'isolation', instructions: 'Sit in machine, bring pads together in front of chest.' },
  { id: 'push-up', name: 'Push-Up', muscleGroup: 'chest', secondaryMuscles: ['triceps', 'shoulders'], equipment: 'bodyweight', type: 'compound', instructions: 'Hands shoulder-width, lower chest to floor, push back up.' },
  { id: 'dips-chest', name: 'Chest Dips', muscleGroup: 'chest', secondaryMuscles: ['triceps', 'shoulders'], equipment: 'bodyweight', type: 'compound', instructions: 'Lean forward on dip bars, lower body, press back up.' },

  // ==================== BACK ====================
  { id: 'deadlift', name: 'Barbell Deadlift', muscleGroup: 'back', secondaryMuscles: ['hamstrings', 'glutes', 'forearms'], equipment: 'barbell', type: 'compound', instructions: 'Stand over bar, hinge at hips, grip bar, drive through heels to stand.' },
  { id: 'barbell-row', name: 'Barbell Bent-Over Row', muscleGroup: 'back', secondaryMuscles: ['biceps', 'forearms'], equipment: 'barbell', type: 'compound', instructions: 'Hinge forward 45 degrees, pull bar to lower chest.' },
  { id: 'pull-up', name: 'Pull-Up', muscleGroup: 'back', secondaryMuscles: ['biceps', 'forearms'], equipment: 'bodyweight', type: 'compound', instructions: 'Hang from bar, pull chin above bar, lower with control.' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', muscleGroup: 'back', secondaryMuscles: ['biceps'], equipment: 'cable', type: 'compound', instructions: 'Sit at machine, pull bar to upper chest, squeeze lats.' },
  { id: 'cable-row', name: 'Seated Cable Row', muscleGroup: 'back', secondaryMuscles: ['biceps', 'forearms'], equipment: 'cable', type: 'compound', instructions: 'Sit upright, pull handle to lower chest, squeeze shoulder blades.' },
  { id: 'db-row', name: 'Dumbbell Row', muscleGroup: 'back', secondaryMuscles: ['biceps'], equipment: 'dumbbell', type: 'compound', instructions: 'One hand on bench, row dumbbell to hip, squeeze lat.' },
  { id: 't-bar-row', name: 'T-Bar Row', muscleGroup: 'back', secondaryMuscles: ['biceps', 'forearms'], equipment: 'barbell', type: 'compound', instructions: 'Straddle bar, pull to chest with close grip handle.' },
  { id: 'face-pull', name: 'Face Pull', muscleGroup: 'back', secondaryMuscles: ['shoulders'], equipment: 'cable', type: 'isolation', instructions: 'Set cable high, pull rope to face, externally rotate at end.' },
  { id: 'straight-arm-pulldown', name: 'Straight Arm Pulldown', muscleGroup: 'back', equipment: 'cable', type: 'isolation', instructions: 'Stand at cable, arms straight, pull bar down to thighs.' },
  { id: 'machine-row', name: 'Machine Row', muscleGroup: 'back', secondaryMuscles: ['biceps'], equipment: 'machine', type: 'compound', instructions: 'Sit at machine, pull handles back squeezing shoulder blades.' },

  // ==================== SHOULDERS ====================
  { id: 'ohp', name: 'Overhead Press', muscleGroup: 'shoulders', secondaryMuscles: ['triceps'], equipment: 'barbell', type: 'compound', instructions: 'Stand with bar at shoulders, press overhead to lockout.' },
  { id: 'db-shoulder-press', name: 'Dumbbell Shoulder Press', muscleGroup: 'shoulders', secondaryMuscles: ['triceps'], equipment: 'dumbbell', type: 'compound', instructions: 'Seated or standing, press dumbbells from shoulders overhead.' },
  { id: 'lateral-raise', name: 'Lateral Raise', muscleGroup: 'shoulders', equipment: 'dumbbell', type: 'isolation', instructions: 'Arms at sides, raise dumbbells to shoulder height, lower slowly.' },
  { id: 'cable-lateral-raise', name: 'Cable Lateral Raise', muscleGroup: 'shoulders', equipment: 'cable', type: 'isolation', instructions: 'Stand beside cable, raise arm to shoulder height.' },
  { id: 'front-raise', name: 'Front Raise', muscleGroup: 'shoulders', equipment: 'dumbbell', type: 'isolation', instructions: 'Raise dumbbells in front to shoulder height, lower slowly.' },
  { id: 'reverse-fly', name: 'Reverse Fly', muscleGroup: 'shoulders', secondaryMuscles: ['back'], equipment: 'dumbbell', type: 'isolation', instructions: 'Bent over, raise dumbbells to sides squeezing rear delts.' },
  { id: 'arnold-press', name: 'Arnold Press', muscleGroup: 'shoulders', secondaryMuscles: ['triceps'], equipment: 'dumbbell', type: 'compound', instructions: 'Start with palms facing you, rotate and press overhead.' },
  { id: 'machine-shoulder-press', name: 'Machine Shoulder Press', muscleGroup: 'shoulders', secondaryMuscles: ['triceps'], equipment: 'machine', type: 'compound', instructions: 'Sit in machine, press handles overhead.' },
  { id: 'upright-row', name: 'Upright Row', muscleGroup: 'shoulders', secondaryMuscles: ['biceps'], equipment: 'barbell', type: 'compound', instructions: 'Pull bar up close to body to chin height, elbows high.' },

  // ==================== BICEPS ====================
  { id: 'barbell-curl', name: 'Barbell Curl', muscleGroup: 'biceps', secondaryMuscles: ['forearms'], equipment: 'barbell', type: 'isolation', instructions: 'Stand with bar, curl to shoulders, lower with control.' },
  { id: 'db-curl', name: 'Dumbbell Curl', muscleGroup: 'biceps', secondaryMuscles: ['forearms'], equipment: 'dumbbell', type: 'isolation', instructions: 'Alternating or together, curl dumbbells to shoulders.' },
  { id: 'hammer-curl', name: 'Hammer Curl', muscleGroup: 'biceps', secondaryMuscles: ['forearms'], equipment: 'dumbbell', type: 'isolation', instructions: 'Neutral grip, curl dumbbells to shoulders.' },
  { id: 'incline-curl', name: 'Incline Dumbbell Curl', muscleGroup: 'biceps', equipment: 'dumbbell', type: 'isolation', instructions: 'Lie on incline bench, let arms hang, curl up.' },
  { id: 'cable-curl', name: 'Cable Curl', muscleGroup: 'biceps', equipment: 'cable', type: 'isolation', instructions: 'Stand at cable, curl bar to shoulders.' },
  { id: 'preacher-curl', name: 'Preacher Curl', muscleGroup: 'biceps', equipment: 'barbell', type: 'isolation', instructions: 'Rest arms on preacher pad, curl bar up.' },
  { id: 'concentration-curl', name: 'Concentration Curl', muscleGroup: 'biceps', equipment: 'dumbbell', type: 'isolation', instructions: 'Sit on bench, brace elbow on inner thigh, curl up.' },

  // ==================== TRICEPS ====================
  { id: 'close-grip-bench', name: 'Close Grip Bench Press', muscleGroup: 'triceps', secondaryMuscles: ['chest', 'shoulders'], equipment: 'barbell', type: 'compound', instructions: 'Grip bar shoulder-width, press focusing on triceps.' },
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', muscleGroup: 'triceps', equipment: 'cable', type: 'isolation', instructions: 'Press cable bar down to full extension, squeeze triceps.' },
  { id: 'overhead-extension', name: 'Overhead Tricep Extension', muscleGroup: 'triceps', equipment: 'dumbbell', type: 'isolation', instructions: 'Hold dumbbell overhead, lower behind head, extend back up.' },
  { id: 'skull-crusher', name: 'Skull Crusher', muscleGroup: 'triceps', equipment: 'barbell', type: 'isolation', instructions: 'Lie on bench, lower bar to forehead, extend back up.' },
  { id: 'tricep-dip', name: 'Tricep Dips', muscleGroup: 'triceps', secondaryMuscles: ['chest', 'shoulders'], equipment: 'bodyweight', type: 'compound', instructions: 'Upright body on dip bars, lower and press back up.' },
  { id: 'cable-kickback', name: 'Cable Kickback', muscleGroup: 'triceps', equipment: 'cable', type: 'isolation', instructions: 'Bent over, extend arm back squeezing tricep.' },
  { id: 'rope-pushdown', name: 'Rope Pushdown', muscleGroup: 'triceps', equipment: 'cable', type: 'isolation', instructions: 'Push rope down and apart at bottom, squeeze triceps.' },

  // ==================== QUADS ====================
  { id: 'squat', name: 'Barbell Back Squat', muscleGroup: 'quads', secondaryMuscles: ['glutes', 'hamstrings'], equipment: 'barbell', type: 'compound', instructions: 'Bar on upper back, squat to parallel or below, drive up.' },
  { id: 'front-squat', name: 'Front Squat', muscleGroup: 'quads', secondaryMuscles: ['glutes', 'abs'], equipment: 'barbell', type: 'compound', instructions: 'Bar on front delts, squat to depth, drive up keeping elbows high.' },
  { id: 'leg-press', name: 'Leg Press', muscleGroup: 'quads', secondaryMuscles: ['glutes'], equipment: 'machine', type: 'compound', instructions: 'Feet shoulder-width on platform, lower sled, press back up.' },
  { id: 'leg-extension', name: 'Leg Extension', muscleGroup: 'quads', equipment: 'machine', type: 'isolation', instructions: 'Sit in machine, extend legs to full lockout, lower slowly.' },
  { id: 'bulgarian-split', name: 'Bulgarian Split Squat', muscleGroup: 'quads', secondaryMuscles: ['glutes'], equipment: 'dumbbell', type: 'compound', instructions: 'Rear foot elevated on bench, squat down on front leg.' },
  { id: 'goblet-squat', name: 'Goblet Squat', muscleGroup: 'quads', secondaryMuscles: ['glutes'], equipment: 'dumbbell', type: 'compound', instructions: 'Hold dumbbell at chest, squat to depth.' },
  { id: 'hack-squat', name: 'Hack Squat', muscleGroup: 'quads', secondaryMuscles: ['glutes'], equipment: 'machine', type: 'compound', instructions: 'Shoulders under pads, squat to depth on machine.' },
  { id: 'lunge', name: 'Walking Lunge', muscleGroup: 'quads', secondaryMuscles: ['glutes', 'hamstrings'], equipment: 'dumbbell', type: 'compound', instructions: 'Step forward into lunge, alternate legs while walking.' },

  // ==================== HAMSTRINGS ====================
  { id: 'rdl', name: 'Romanian Deadlift', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes', 'back'], equipment: 'barbell', type: 'compound', instructions: 'Slight knee bend, hinge at hips, lower bar along legs, squeeze back up.' },
  { id: 'db-rdl', name: 'Dumbbell Romanian Deadlift', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes'], equipment: 'dumbbell', type: 'compound', instructions: 'Hold dumbbells, hinge at hips, feel hamstring stretch.' },
  { id: 'leg-curl', name: 'Lying Leg Curl', muscleGroup: 'hamstrings', equipment: 'machine', type: 'isolation', instructions: 'Lie face down, curl weight toward glutes.' },
  { id: 'seated-leg-curl', name: 'Seated Leg Curl', muscleGroup: 'hamstrings', equipment: 'machine', type: 'isolation', instructions: 'Sit in machine, curl legs under seat.' },
  { id: 'good-morning', name: 'Good Morning', muscleGroup: 'hamstrings', secondaryMuscles: ['back', 'glutes'], equipment: 'barbell', type: 'compound', instructions: 'Bar on back, hinge at hips keeping back straight.' },
  { id: 'nordic-curl', name: 'Nordic Hamstring Curl', muscleGroup: 'hamstrings', equipment: 'bodyweight', type: 'isolation', instructions: 'Kneel, feet anchored, lower body forward under control.' },

  // ==================== GLUTES ====================
  { id: 'hip-thrust', name: 'Barbell Hip Thrust', muscleGroup: 'glutes', secondaryMuscles: ['hamstrings'], equipment: 'barbell', type: 'compound', instructions: 'Upper back on bench, bar on hips, drive hips up squeezing glutes.' },
  { id: 'cable-pull-through', name: 'Cable Pull Through', muscleGroup: 'glutes', secondaryMuscles: ['hamstrings'], equipment: 'cable', type: 'compound', instructions: 'Face away from cable, hinge at hips, pull through legs.' },
  { id: 'glute-bridge', name: 'Glute Bridge', muscleGroup: 'glutes', secondaryMuscles: ['hamstrings'], equipment: 'bodyweight', type: 'isolation', instructions: 'Lie on back, feet flat, drive hips up, squeeze glutes.' },
  { id: 'cable-kickback-glute', name: 'Cable Glute Kickback', muscleGroup: 'glutes', equipment: 'cable', type: 'isolation', instructions: 'Attach ankle strap, kick leg back squeezing glute.' },
  { id: 'step-up', name: 'Step-Up', muscleGroup: 'glutes', secondaryMuscles: ['quads'], equipment: 'dumbbell', type: 'compound', instructions: 'Step up onto box/bench driving through heel.' },

  // ==================== CALVES ====================
  { id: 'standing-calf-raise', name: 'Standing Calf Raise', muscleGroup: 'calves', equipment: 'machine', type: 'isolation', instructions: 'Stand on edge of platform, raise heels as high as possible.' },
  { id: 'seated-calf-raise', name: 'Seated Calf Raise', muscleGroup: 'calves', equipment: 'machine', type: 'isolation', instructions: 'Sit in machine, raise heels focusing on squeeze at top.' },
  { id: 'db-calf-raise', name: 'Dumbbell Calf Raise', muscleGroup: 'calves', equipment: 'dumbbell', type: 'isolation', instructions: 'Hold dumbbells, stand on edge, raise and lower heels.' },

  // ==================== ABS ====================
  { id: 'crunch', name: 'Crunch', muscleGroup: 'abs', equipment: 'bodyweight', type: 'isolation', instructions: 'Lie on back, hands behind head, curl torso up.' },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', muscleGroup: 'abs', equipment: 'bodyweight', type: 'compound', instructions: 'Hang from bar, raise legs to 90 degrees or higher.' },
  { id: 'cable-crunch', name: 'Cable Crunch', muscleGroup: 'abs', equipment: 'cable', type: 'isolation', instructions: 'Kneel at cable, crunch down squeezing abs.' },
  { id: 'plank', name: 'Plank', muscleGroup: 'abs', equipment: 'bodyweight', type: 'isolation', instructions: 'Hold push-up position on forearms, keep body straight.' },
  { id: 'ab-wheel', name: 'Ab Wheel Rollout', muscleGroup: 'abs', equipment: 'bodyweight', type: 'compound', instructions: 'Roll wheel out from knees, extend as far as possible, roll back.' },
  { id: 'russian-twist', name: 'Russian Twist', muscleGroup: 'abs', equipment: 'bodyweight', type: 'isolation', instructions: 'Sit with torso angled back, rotate side to side with or without weight.' },
  { id: 'mountain-climber', name: 'Mountain Climber', muscleGroup: 'abs', equipment: 'bodyweight', type: 'compound', instructions: 'Push-up position, alternate driving knees to chest.' },

  // ==================== FOREARMS ====================
  { id: 'wrist-curl', name: 'Wrist Curl', muscleGroup: 'forearms', equipment: 'barbell', type: 'isolation', instructions: 'Forearms on bench, curl wrists up with bar.' },
  { id: 'reverse-wrist-curl', name: 'Reverse Wrist Curl', muscleGroup: 'forearms', equipment: 'barbell', type: 'isolation', instructions: 'Forearms on bench, palms down, extend wrists up.' },
  { id: 'farmer-walk', name: "Farmer's Walk", muscleGroup: 'forearms', secondaryMuscles: ['shoulders', 'abs'], equipment: 'dumbbell', type: 'compound', instructions: 'Hold heavy dumbbells at sides, walk with upright posture.' },
];

export function getExerciseById(id: string): Exercise | undefined {
  return exercises.find(e => e.id === id);
}

export function getExercisesByMuscleGroup(muscleGroup: string): Exercise[] {
  return exercises.filter(e => e.muscleGroup === muscleGroup);
}

export function getExercisesByEquipment(equipment: string): Exercise[] {
  return exercises.filter(e => e.equipment === equipment);
}

export function getCompoundExercises(): Exercise[] {
  return exercises.filter(e => e.type === 'compound');
}

export function getIsolationExercises(): Exercise[] {
  return exercises.filter(e => e.type === 'isolation');
}
