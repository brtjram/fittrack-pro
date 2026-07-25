'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { MacroRing } from '@/components/nutrition/macro-ring';
import { MealCard } from '@/components/nutrition/meal-card';
import { FoodSearch } from '@/components/nutrition/food-search';
import { DatePicker } from '@/components/shared/date-picker';
import { Pill, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { getFoodLogByDate, addFoodLogEntry, updateFoodLogEntry, deleteFoodLogEntry } from '@/lib/stores/nutrition-store';
import { getWeightEntries } from '@/lib/stores/nutrition-store';
import { getUserProfile } from '@/lib/stores/user-store';
import { calculateMacroTargets, calculateAdaptiveAdjustment } from '@/lib/algorithms/macro-calculator';
import type { FoodLogEntry, FoodItem, MealType, MacroTargets } from '@/types';
import { toDateString } from '@/lib/utils';
import Link from 'next/link';

const meals: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function NutritionPage() {
  const [date, setDate] = useState(toDateString());
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [targets, setTargets] = useState<MacroTargets>({ calories: 2000, protein: 180, carbs: 200, fat: 65 });
  const [searchMeal, setSearchMeal] = useState<MealType | null>(null);
  const [adjustmentNote, setAdjustmentNote] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [date]);

  const loadData = async () => {
    const [log, profile, weights] = await Promise.all([
      getFoodLogByDate(date),
      getUserProfile(),
      getWeightEntries(30),
    ]);

    setEntries(log);

    if (profile) {
      const macros = calculateMacroTargets(profile);
      const adjustment = calculateAdaptiveAdjustment(macros.calories, weights, profile.goal);
      if (adjustment.shouldAdjust) {
        setTargets({
          ...macros,
          calories: adjustment.newCalories,
          carbs: macros.carbs + Math.round(adjustment.adjustment / 4),
        });
        setAdjustmentNote(adjustment.reason);
      } else {
        setTargets(macros);
        setAdjustmentNote(adjustment.reason);
      }
    }
  };

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const handleAddFood = async (food: FoodItem, servings: number) => {
    if (!searchMeal) return;
    const factor = (food.servingSizeG * servings) / 100;
    await addFoodLogEntry({
      date,
      foodItemId: food.id,
      foodName: food.name,
      servings,
      servingSizeG: food.servingSizeG,
      meal: searchMeal,
      calories: food.caloriesPer100g * factor,
      protein: food.proteinPer100g * factor,
      carbs: food.carbsPer100g * factor,
      fat: food.fatPer100g * factor,
    });
    setSearchMeal(null);
    loadData();
  };

  const handleAddFoods = async (items: Array<{ food: FoodItem; servings: number }>) => {
    if (!searchMeal) return;
    await Promise.all(items.map(({ food, servings }) => {
      const factor = (food.servingSizeG * servings) / 100;
      return addFoodLogEntry({
        date,
        foodItemId: food.id,
        foodName: food.name,
        servings,
        servingSizeG: food.servingSizeG,
        meal: searchMeal,
        calories: food.caloriesPer100g * factor,
        protein: food.proteinPer100g * factor,
        carbs: food.carbsPer100g * factor,
        fat: food.fatPer100g * factor,
      });
    }));
    setSearchMeal(null);
    loadData();
  };

  const handleDelete = async (id: string) => {
    await deleteFoodLogEntry(id);
    loadData();
  };

  const handleEdit = async (id: string, updates: Partial<FoodLogEntry>) => {
    await updateFoodLogEntry(id, updates);
    loadData();
  };

  const changeDate = (delta: number) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setDate(toDateString(d));
  };

  const isToday = date === toDateString();

  return (
    <div className="min-h-screen">
      <Header
        title="Nutrition"
        action={
          <Link
            href="/nutrition/supplements"
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            <Pill className="h-4 w-4" />
            Supplements
          </Link>
        }
      />

      <div className="mx-auto max-w-lg space-y-6 p-4">
        {/* Date Selector with Calendar */}
        <div className="flex items-center justify-between">
          <button onClick={() => changeDate(-1)} className="rounded-lg p-2 hover:bg-accent">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <DatePicker value={date} onChange={setDate} maxDate={toDateString()} />
          <button onClick={() => changeDate(1)} className="rounded-lg p-2 hover:bg-accent" disabled={isToday}>
            <ChevronRight className="h-5 w-5 disabled:opacity-30" />
          </button>
        </div>

        {/* Macro Rings */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 text-center">
            <div className="text-3xl font-bold">{Math.round(targets.calories - totals.calories)}</div>
            <div className="text-sm text-muted-foreground">calories remaining</div>
          </div>
          <div className="flex justify-around">
            <MacroRing label="Protein" current={totals.protein} target={targets.protein} color="var(--chart-1)" />
            <MacroRing label="Carbs" current={totals.carbs} target={targets.carbs} color="var(--chart-3)" />
            <MacroRing label="Fat" current={totals.fat} target={targets.fat} color="var(--chart-4)" />
          </div>
        </div>

        {/* Adaptive Adjustment Note */}
        {adjustmentNote && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs text-muted-foreground">{adjustmentNote}</p>
          </div>
        )}

        {/* Meals */}
        {meals.map((meal) => (
          <MealCard
            key={meal}
            meal={meal}
            entries={entries.filter((e) => e.meal === meal)}
            onAddFood={() => setSearchMeal(meal)}
            onDeleteEntry={handleDelete}
            onEditEntry={handleEdit}
          />
        ))}
      </div>

      {/* Food Search Modal */}
      {searchMeal && (
        <FoodSearch
          meal={searchMeal}
          onSelect={handleAddFood}
          onSelectMultiple={handleAddFoods}
          onClose={() => setSearchMeal(null)}
        />
      )}
    </div>
  );
}
