import type { Supplement } from '../types';

export const supplements: Supplement[] = [
  // ==================== CORE ====================
  {
    id: 'creatine',
    name: 'Creatine Monohydrate',
    dosage: '5g daily',
    timing: 'Any time of day, with or without food',
    benefits: ['Increased strength & power output', 'Enhanced muscle recovery', 'Improved high-intensity performance', 'Supports brain health'],
    evidenceLevel: 'strong',
    category: 'core',
    goals: ['fat_loss', 'muscle_gain', 'recomp', 'maintain'],
    notes: 'Most studied supplement. No loading phase needed. Take consistently every day.',
  },
  {
    id: 'vitamin-d3',
    name: 'Vitamin D3',
    dosage: '2,000-5,000 IU daily',
    timing: 'With a meal containing fat for absorption',
    benefits: ['Supports bone health', 'Immune system function', 'Mood regulation', 'Hormone optimization'],
    evidenceLevel: 'strong',
    category: 'core',
    goals: ['fat_loss', 'muscle_gain', 'recomp', 'maintain'],
    notes: 'Most people are deficient. Get blood levels tested to optimize dose.',
  },
  {
    id: 'omega-3',
    name: 'Omega-3 Fish Oil',
    dosage: '2-3g EPA+DHA combined daily',
    timing: 'With meals to reduce fishy aftertaste',
    benefits: ['Reduces inflammation', 'Heart health', 'Joint support', 'Brain function', 'May improve body composition'],
    evidenceLevel: 'strong',
    category: 'core',
    goals: ['fat_loss', 'muscle_gain', 'recomp', 'maintain'],
    contraindications: ['Blood thinning medications'],
    notes: 'Look for products with high EPA+DHA per capsule. Store in fridge.',
  },
  {
    id: 'magnesium',
    name: 'Magnesium Glycinate',
    dosage: '200-400mg elemental magnesium daily',
    timing: 'Evening, 30-60 minutes before bed',
    benefits: ['Improved sleep quality', 'Muscle relaxation & recovery', 'Reduced cramps', 'Stress reduction'],
    evidenceLevel: 'strong',
    category: 'core',
    goals: ['fat_loss', 'muscle_gain', 'recomp', 'maintain'],
    notes: 'Glycinate form is best absorbed and least likely to cause GI issues.',
  },

  // ==================== FAT LOSS SUPPORT ====================
  {
    id: 'caffeine',
    name: 'Caffeine',
    dosage: '100-200mg, 30 min pre-workout',
    timing: 'Morning or pre-workout. Avoid after 2 PM for sleep quality.',
    benefits: ['Increased energy & focus', 'Enhanced fat oxidation', 'Improved workout performance', 'Appetite suppression'],
    evidenceLevel: 'strong',
    category: 'fat_loss',
    goals: ['fat_loss'],
    contraindications: ['Anxiety disorders', 'Heart conditions', 'Pregnancy'],
    notes: 'Cycle off periodically to maintain sensitivity. Start with lower doses.',
  },
  {
    id: 'green-tea-extract',
    name: 'Green Tea Extract (EGCG)',
    dosage: '250-500mg EGCG daily',
    timing: 'With meals',
    benefits: ['Modest increase in metabolic rate', 'Antioxidant properties', 'May enhance fat oxidation during exercise'],
    evidenceLevel: 'moderate',
    category: 'fat_loss',
    goals: ['fat_loss'],
    contraindications: ['Liver conditions - use standardized extracts'],
    notes: 'Effects are modest. Best combined with caffeine for synergy.',
  },
  {
    id: 'l-carnitine',
    name: 'L-Carnitine',
    dosage: '2-3g daily (L-Carnitine L-Tartrate)',
    timing: 'With a high-carb meal for better uptake',
    benefits: ['Supports fat transport to mitochondria', 'May reduce muscle soreness', 'Recovery support'],
    evidenceLevel: 'moderate',
    category: 'fat_loss',
    goals: ['fat_loss', 'recomp'],
    notes: 'Takes 2-3 months of consistent use to saturate muscle stores.',
  },

  // ==================== RECOVERY ====================
  {
    id: 'whey-protein-supp',
    name: 'Whey Protein',
    dosage: '25-40g per serving, 1-2 servings daily',
    timing: 'Post-workout and/or between meals to hit protein targets',
    benefits: ['Convenient protein source', 'Fast-absorbing', 'Complete amino acid profile', 'Supports muscle recovery'],
    evidenceLevel: 'strong',
    category: 'recovery',
    goals: ['fat_loss', 'muscle_gain', 'recomp', 'maintain'],
    contraindications: ['Lactose intolerance (try isolate or plant protein)'],
    notes: 'Not magic - just a convenient way to hit daily protein goals. Whole foods first.',
  },
  {
    id: 'zma',
    name: 'ZMA (Zinc, Magnesium, B6)',
    dosage: 'Zinc 30mg, Magnesium 450mg, B6 10mg',
    timing: '30-60 minutes before bed on empty stomach',
    benefits: ['Improved sleep', 'Testosterone support', 'Recovery enhancement', 'Immune support'],
    evidenceLevel: 'moderate',
    category: 'recovery',
    goals: ['muscle_gain', 'recomp', 'fat_loss'],
    notes: 'Skip if already taking magnesium separately. Don\'t take with calcium.',
  },
  {
    id: 'tart-cherry',
    name: 'Tart Cherry Extract',
    dosage: '500mg extract or 8oz juice, twice daily',
    timing: 'Morning and evening',
    benefits: ['Reduced muscle soreness (DOMS)', 'Anti-inflammatory', 'Improved sleep quality', 'Antioxidant'],
    evidenceLevel: 'moderate',
    category: 'recovery',
    goals: ['fat_loss', 'muscle_gain', 'recomp'],
    notes: 'Particularly useful during high-volume training phases.',
  },

  // ==================== GENERAL HEALTH ====================
  {
    id: 'multivitamin',
    name: 'Multivitamin',
    dosage: '1 serving daily as directed on label',
    timing: 'With breakfast',
    benefits: ['Fills nutritional gaps', 'Insurance policy for micronutrients', 'Supports overall health'],
    evidenceLevel: 'moderate',
    category: 'health',
    goals: ['fat_loss', 'muscle_gain', 'recomp', 'maintain'],
    notes: 'Not a substitute for a balanced diet. Most useful during caloric deficit.',
  },
  {
    id: 'probiotics',
    name: 'Probiotics',
    dosage: '10-50 billion CFU daily',
    timing: 'Morning, with or without food',
    benefits: ['Gut health', 'Improved digestion', 'Immune support', 'May support mood'],
    evidenceLevel: 'moderate',
    category: 'health',
    goals: ['fat_loss', 'muscle_gain', 'recomp', 'maintain'],
    notes: 'Look for multi-strain formulas. Refrigerated varieties tend to be higher quality.',
  },
  {
    id: 'vitamin-k2',
    name: 'Vitamin K2 (MK-7)',
    dosage: '100-200mcg daily',
    timing: 'With Vitamin D3 and a fat-containing meal',
    benefits: ['Directs calcium to bones (not arteries)', 'Synergistic with Vitamin D3', 'Heart health'],
    evidenceLevel: 'moderate',
    category: 'health',
    goals: ['fat_loss', 'muscle_gain', 'recomp', 'maintain'],
    contraindications: ['Warfarin/blood thinners - consult doctor'],
    notes: 'Pairs perfectly with Vitamin D3. Many D3 supplements now include K2.',
  },
  {
    id: 'electrolytes',
    name: 'Electrolyte Complex',
    dosage: 'Sodium 1000mg, Potassium 200mg, Magnesium 60mg per serving',
    timing: 'During/after intense workouts, or morning',
    benefits: ['Hydration', 'Prevents cramps', 'Energy levels', 'Essential during caloric deficit'],
    evidenceLevel: 'strong',
    category: 'health',
    goals: ['fat_loss', 'muscle_gain', 'recomp', 'maintain'],
    notes: 'Especially important during fat loss when water and sodium intake may be low.',
  },
];

export function getSupplementsByGoal(goal: string): Supplement[] {
  return supplements.filter(s => s.goals.includes(goal as Supplement['goals'][number]));
}

export function getSupplementsByCategory(category: string): Supplement[] {
  return supplements.filter(s => s.category === category);
}

export function getCoreSupplements(): Supplement[] {
  return supplements.filter(s => s.category === 'core');
}
