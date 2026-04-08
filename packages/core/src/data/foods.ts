import type { FoodItem } from '../types';

export const foods: FoodItem[] = [
  // ==================== PROTEIN SOURCES ====================
  { id: 'chicken-breast', name: 'Chicken Breast (cooked)', caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6, servingSizeG: 150, servingLabel: '1 breast', category: 'protein' },
  { id: 'chicken-thigh', name: 'Chicken Thigh (cooked)', caloriesPer100g: 209, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 11, servingSizeG: 120, servingLabel: '1 thigh', category: 'protein' },
  { id: 'turkey-breast', name: 'Turkey Breast (cooked)', caloriesPer100g: 135, proteinPer100g: 30, carbsPer100g: 0, fatPer100g: 1, servingSizeG: 150, servingLabel: '1 serving', category: 'protein' },
  { id: 'ground-turkey', name: 'Ground Turkey (93% lean)', caloriesPer100g: 170, proteinPer100g: 21, carbsPer100g: 0, fatPer100g: 9.4, servingSizeG: 120, servingLabel: '1 serving', category: 'protein' },
  { id: 'beef-sirloin', name: 'Beef Sirloin (cooked)', caloriesPer100g: 206, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 11, servingSizeG: 170, servingLabel: '1 steak', category: 'protein' },
  { id: 'ground-beef-90', name: 'Ground Beef (90% lean)', caloriesPer100g: 196, proteinPer100g: 20, carbsPer100g: 0, fatPer100g: 12, servingSizeG: 120, servingLabel: '1 patty', category: 'protein' },
  { id: 'salmon', name: 'Salmon Fillet (cooked)', caloriesPer100g: 208, proteinPer100g: 20, carbsPer100g: 0, fatPer100g: 13, servingSizeG: 170, servingLabel: '1 fillet', category: 'protein' },
  { id: 'tuna', name: 'Tuna (canned in water)', caloriesPer100g: 116, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 0.8, servingSizeG: 85, servingLabel: '1 can', category: 'protein' },
  { id: 'tilapia', name: 'Tilapia (cooked)', caloriesPer100g: 128, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 2.7, servingSizeG: 150, servingLabel: '1 fillet', category: 'protein' },
  { id: 'shrimp', name: 'Shrimp (cooked)', caloriesPer100g: 99, proteinPer100g: 24, carbsPer100g: 0.2, fatPer100g: 0.3, servingSizeG: 85, servingLabel: '1 serving', category: 'protein' },
  { id: 'eggs', name: 'Whole Egg', caloriesPer100g: 155, proteinPer100g: 13, carbsPer100g: 1.1, fatPer100g: 11, servingSizeG: 50, servingLabel: '1 egg', category: 'protein' },
  { id: 'egg-whites', name: 'Egg Whites', caloriesPer100g: 52, proteinPer100g: 11, carbsPer100g: 0.7, fatPer100g: 0.2, servingSizeG: 33, servingLabel: '1 egg white', category: 'protein' },
  { id: 'pork-loin', name: 'Pork Loin (cooked)', caloriesPer100g: 187, proteinPer100g: 26, carbsPer100g: 0, fatPer100g: 8.6, servingSizeG: 150, servingLabel: '1 serving', category: 'protein' },
  { id: 'tofu-firm', name: 'Tofu (firm)', caloriesPer100g: 144, proteinPer100g: 17, carbsPer100g: 3, fatPer100g: 9, servingSizeG: 125, servingLabel: '1/2 block', category: 'protein' },
  { id: 'tempeh', name: 'Tempeh', caloriesPer100g: 192, proteinPer100g: 20, carbsPer100g: 8, fatPer100g: 11, servingSizeG: 85, servingLabel: '1 serving', category: 'protein' },

  // ==================== DAIRY ====================
  { id: 'greek-yogurt', name: 'Greek Yogurt (0% fat)', caloriesPer100g: 59, proteinPer100g: 10, carbsPer100g: 3.6, fatPer100g: 0.4, servingSizeG: 170, servingLabel: '1 cup', category: 'dairy' },
  { id: 'greek-yogurt-full', name: 'Greek Yogurt (full fat)', caloriesPer100g: 97, proteinPer100g: 9, carbsPer100g: 3.9, fatPer100g: 5, servingSizeG: 170, servingLabel: '1 cup', category: 'dairy' },
  { id: 'cottage-cheese', name: 'Cottage Cheese (low fat)', caloriesPer100g: 72, proteinPer100g: 12, carbsPer100g: 2.7, fatPer100g: 1, servingSizeG: 225, servingLabel: '1 cup', category: 'dairy' },
  { id: 'milk-whole', name: 'Whole Milk', caloriesPer100g: 61, proteinPer100g: 3.2, carbsPer100g: 4.8, fatPer100g: 3.3, servingSizeG: 244, servingLabel: '1 cup', category: 'dairy' },
  { id: 'milk-skim', name: 'Skim Milk', caloriesPer100g: 34, proteinPer100g: 3.4, carbsPer100g: 5, fatPer100g: 0.1, servingSizeG: 244, servingLabel: '1 cup', category: 'dairy' },
  { id: 'cheddar', name: 'Cheddar Cheese', caloriesPer100g: 403, proteinPer100g: 25, carbsPer100g: 1.3, fatPer100g: 33, servingSizeG: 28, servingLabel: '1 slice', category: 'dairy' },
  { id: 'mozzarella', name: 'Mozzarella (part-skim)', caloriesPer100g: 254, proteinPer100g: 24, carbsPer100g: 2.8, fatPer100g: 16, servingSizeG: 28, servingLabel: '1 oz', category: 'dairy' },

  // ==================== GRAINS & CARBS ====================
  { id: 'white-rice', name: 'White Rice (cooked)', caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3, fiberPer100g: 0.4, servingSizeG: 185, servingLabel: '1 cup', category: 'grain' },
  { id: 'brown-rice', name: 'Brown Rice (cooked)', caloriesPer100g: 112, proteinPer100g: 2.6, carbsPer100g: 24, fatPer100g: 0.9, fiberPer100g: 1.8, servingSizeG: 185, servingLabel: '1 cup', category: 'grain' },
  { id: 'oats', name: 'Oats (dry)', caloriesPer100g: 389, proteinPer100g: 17, carbsPer100g: 66, fatPer100g: 7, fiberPer100g: 11, servingSizeG: 40, servingLabel: '1/2 cup', category: 'grain' },
  { id: 'pasta', name: 'Pasta (cooked)', caloriesPer100g: 131, proteinPer100g: 5, carbsPer100g: 25, fatPer100g: 1.1, fiberPer100g: 1.8, servingSizeG: 140, servingLabel: '1 cup', category: 'grain' },
  { id: 'whole-wheat-bread', name: 'Whole Wheat Bread', caloriesPer100g: 247, proteinPer100g: 13, carbsPer100g: 41, fatPer100g: 3.4, fiberPer100g: 7, servingSizeG: 36, servingLabel: '1 slice', category: 'grain' },
  { id: 'white-bread', name: 'White Bread', caloriesPer100g: 265, proteinPer100g: 9, carbsPer100g: 49, fatPer100g: 3.2, fiberPer100g: 2.7, servingSizeG: 30, servingLabel: '1 slice', category: 'grain' },
  { id: 'sweet-potato', name: 'Sweet Potato (baked)', caloriesPer100g: 90, proteinPer100g: 2, carbsPer100g: 21, fatPer100g: 0.1, fiberPer100g: 3.3, servingSizeG: 150, servingLabel: '1 medium', category: 'grain' },
  { id: 'potato', name: 'Potato (baked)', caloriesPer100g: 93, proteinPer100g: 2.5, carbsPer100g: 21, fatPer100g: 0.1, fiberPer100g: 2.2, servingSizeG: 170, servingLabel: '1 medium', category: 'grain' },
  { id: 'quinoa', name: 'Quinoa (cooked)', caloriesPer100g: 120, proteinPer100g: 4.4, carbsPer100g: 21, fatPer100g: 1.9, fiberPer100g: 2.8, servingSizeG: 185, servingLabel: '1 cup', category: 'grain' },
  { id: 'tortilla-wheat', name: 'Whole Wheat Tortilla', caloriesPer100g: 306, proteinPer100g: 10, carbsPer100g: 50, fatPer100g: 8, fiberPer100g: 5, servingSizeG: 45, servingLabel: '1 tortilla', category: 'grain' },
  { id: 'bagel', name: 'Bagel (plain)', caloriesPer100g: 257, proteinPer100g: 10, carbsPer100g: 50, fatPer100g: 1.6, servingSizeG: 105, servingLabel: '1 bagel', category: 'grain' },

  // ==================== FRUITS ====================
  { id: 'banana', name: 'Banana', caloriesPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 23, fatPer100g: 0.3, fiberPer100g: 2.6, servingSizeG: 118, servingLabel: '1 medium', category: 'fruit' },
  { id: 'apple', name: 'Apple', caloriesPer100g: 52, proteinPer100g: 0.3, carbsPer100g: 14, fatPer100g: 0.2, fiberPer100g: 2.4, servingSizeG: 182, servingLabel: '1 medium', category: 'fruit' },
  { id: 'blueberries', name: 'Blueberries', caloriesPer100g: 57, proteinPer100g: 0.7, carbsPer100g: 14, fatPer100g: 0.3, fiberPer100g: 2.4, servingSizeG: 148, servingLabel: '1 cup', category: 'fruit' },
  { id: 'strawberries', name: 'Strawberries', caloriesPer100g: 32, proteinPer100g: 0.7, carbsPer100g: 7.7, fatPer100g: 0.3, fiberPer100g: 2, servingSizeG: 152, servingLabel: '1 cup', category: 'fruit' },
  { id: 'orange', name: 'Orange', caloriesPer100g: 47, proteinPer100g: 0.9, carbsPer100g: 12, fatPer100g: 0.1, fiberPer100g: 2.4, servingSizeG: 131, servingLabel: '1 medium', category: 'fruit' },
  { id: 'avocado', name: 'Avocado', caloriesPer100g: 160, proteinPer100g: 2, carbsPer100g: 8.5, fatPer100g: 15, fiberPer100g: 6.7, servingSizeG: 68, servingLabel: '1/2 avocado', category: 'fruit' },

  // ==================== VEGETABLES ====================
  { id: 'broccoli', name: 'Broccoli (cooked)', caloriesPer100g: 35, proteinPer100g: 2.4, carbsPer100g: 7, fatPer100g: 0.4, fiberPer100g: 3.3, servingSizeG: 156, servingLabel: '1 cup', category: 'vegetable' },
  { id: 'spinach', name: 'Spinach (raw)', caloriesPer100g: 23, proteinPer100g: 2.9, carbsPer100g: 3.6, fatPer100g: 0.4, fiberPer100g: 2.2, servingSizeG: 30, servingLabel: '1 cup', category: 'vegetable' },
  { id: 'green-beans', name: 'Green Beans (cooked)', caloriesPer100g: 35, proteinPer100g: 1.8, carbsPer100g: 7, fatPer100g: 0.3, fiberPer100g: 3.4, servingSizeG: 125, servingLabel: '1 cup', category: 'vegetable' },
  { id: 'bell-pepper', name: 'Bell Pepper', caloriesPer100g: 31, proteinPer100g: 1, carbsPer100g: 6, fatPer100g: 0.3, fiberPer100g: 2.1, servingSizeG: 119, servingLabel: '1 medium', category: 'vegetable' },
  { id: 'asparagus', name: 'Asparagus (cooked)', caloriesPer100g: 22, proteinPer100g: 2.4, carbsPer100g: 4, fatPer100g: 0.2, fiberPer100g: 2, servingSizeG: 134, servingLabel: '6 spears', category: 'vegetable' },
  { id: 'mixed-salad', name: 'Mixed Green Salad', caloriesPer100g: 17, proteinPer100g: 1.3, carbsPer100g: 3.1, fatPer100g: 0.2, fiberPer100g: 1.5, servingSizeG: 85, servingLabel: '2 cups', category: 'vegetable' },

  // ==================== FATS & NUTS ====================
  { id: 'olive-oil', name: 'Olive Oil', caloriesPer100g: 884, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100, servingSizeG: 14, servingLabel: '1 tbsp', category: 'fat' },
  { id: 'butter', name: 'Butter', caloriesPer100g: 717, proteinPer100g: 0.9, carbsPer100g: 0.1, fatPer100g: 81, servingSizeG: 14, servingLabel: '1 tbsp', category: 'fat' },
  { id: 'almonds', name: 'Almonds', caloriesPer100g: 579, proteinPer100g: 21, carbsPer100g: 22, fatPer100g: 50, fiberPer100g: 12, servingSizeG: 28, servingLabel: '1 oz (23 almonds)', category: 'fat' },
  { id: 'peanut-butter', name: 'Peanut Butter', caloriesPer100g: 588, proteinPer100g: 25, carbsPer100g: 20, fatPer100g: 50, fiberPer100g: 6, servingSizeG: 32, servingLabel: '2 tbsp', category: 'fat' },
  { id: 'walnuts', name: 'Walnuts', caloriesPer100g: 654, proteinPer100g: 15, carbsPer100g: 14, fatPer100g: 65, fiberPer100g: 7, servingSizeG: 28, servingLabel: '1 oz', category: 'fat' },
  { id: 'coconut-oil', name: 'Coconut Oil', caloriesPer100g: 862, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100, servingSizeG: 14, servingLabel: '1 tbsp', category: 'fat' },

  // ==================== SUPPLEMENTS & SHAKES ====================
  { id: 'whey-protein', name: 'Whey Protein Powder', caloriesPer100g: 375, proteinPer100g: 75, carbsPer100g: 10, fatPer100g: 5, servingSizeG: 32, servingLabel: '1 scoop', category: 'supplement' },
  { id: 'casein-protein', name: 'Casein Protein Powder', caloriesPer100g: 362, proteinPer100g: 72, carbsPer100g: 12, fatPer100g: 3, servingSizeG: 34, servingLabel: '1 scoop', category: 'supplement' },
  { id: 'creatine', name: 'Creatine Monohydrate', caloriesPer100g: 0, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0, servingSizeG: 5, servingLabel: '1 tsp (5g)', category: 'supplement' },

  // ==================== BEVERAGES ====================
  { id: 'black-coffee', name: 'Black Coffee', caloriesPer100g: 1, proteinPer100g: 0.1, carbsPer100g: 0, fatPer100g: 0, servingSizeG: 240, servingLabel: '1 cup', category: 'beverage' },
  { id: 'orange-juice', name: 'Orange Juice', caloriesPer100g: 45, proteinPer100g: 0.7, carbsPer100g: 10, fatPer100g: 0.2, servingSizeG: 248, servingLabel: '1 cup', category: 'beverage' },
  { id: 'protein-shake', name: 'Protein Shake (milk + whey)', caloriesPer100g: 80, proteinPer100g: 12, carbsPer100g: 6, fatPer100g: 2, servingSizeG: 350, servingLabel: '1 shake', category: 'beverage' },

  // ==================== SNACKS ====================
  { id: 'rice-cake', name: 'Rice Cake', caloriesPer100g: 387, proteinPer100g: 8, carbsPer100g: 82, fatPer100g: 2.8, servingSizeG: 9, servingLabel: '1 cake', category: 'snack' },
  { id: 'dark-chocolate', name: 'Dark Chocolate (70%)', caloriesPer100g: 598, proteinPer100g: 7.8, carbsPer100g: 46, fatPer100g: 43, fiberPer100g: 11, servingSizeG: 28, servingLabel: '1 oz', category: 'snack' },
  { id: 'protein-bar', name: 'Protein Bar', caloriesPer100g: 350, proteinPer100g: 30, carbsPer100g: 35, fatPer100g: 12, fiberPer100g: 5, servingSizeG: 60, servingLabel: '1 bar', category: 'snack' },
  { id: 'trail-mix', name: 'Trail Mix', caloriesPer100g: 462, proteinPer100g: 13, carbsPer100g: 47, fatPer100g: 28, fiberPer100g: 4, servingSizeG: 40, servingLabel: '1/4 cup', category: 'snack' },
];

export function getFoodById(id: string): FoodItem | undefined {
  return foods.find(f => f.id === id);
}

export function searchFoods(query: string): FoodItem[] {
  const q = query.toLowerCase();
  return foods.filter(f => f.name.toLowerCase().includes(q));
}

export function getFoodsByCategory(category: string): FoodItem[] {
  return foods.filter(f => f.category === category);
}
