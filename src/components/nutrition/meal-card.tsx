'use client';

import { useState } from 'react';
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react';
import type { FoodLogEntry, MealType } from '@/types';

interface MealCardProps {
  meal: MealType;
  entries: FoodLogEntry[];
  onAddFood: () => void;
  onDeleteEntry: (id: string) => void;
  onEditEntry: (id: string, updates: Partial<FoodLogEntry>) => void;
}

interface EditState {
  foodName: string;
  servings: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

const mealIcons: Record<MealType, string> = {
  breakfast: '\u2600\uFE0F',
  lunch: '\uD83C\uDF1E',
  dinner: '\uD83C\uDF19',
  snack: '\uD83C\uDF7F',
};

const mealLabels: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export function MealCard({ meal, entries, onAddFood, onDeleteEntry, onEditEntry }: MealCardProps) {
  const totalCalories = entries.reduce((sum, e) => sum + e.calories, 0);
  const totalProtein = entries.reduce((sum, e) => sum + e.protein, 0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);

  const startEdit = (entry: FoodLogEntry) => {
    if (!entry.id) return;
    setEditingId(entry.id);
    setEdit({
      foodName: entry.foodName,
      servings: String(entry.servings),
      calories: String(Math.round(entry.calories)),
      protein: String(Math.round(entry.protein)),
      carbs: String(Math.round(entry.carbs)),
      fat: String(Math.round(entry.fat)),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEdit(null);
  };

  const saveEdit = () => {
    if (!editingId || !edit) return;
    onEditEntry(editingId, {
      foodName: edit.foodName,
      servings: Number(edit.servings) || 0,
      calories: Number(edit.calories) || 0,
      protein: Number(edit.protein) || 0,
      carbs: Number(edit.carbs) || 0,
      fat: Number(edit.fat) || 0,
    });
    cancelEdit();
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{mealIcons[meal]}</span>
          <div>
            <h3 className="font-semibold">{mealLabels[meal]}</h3>
            {entries.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {Math.round(totalCalories)} cal &middot; {Math.round(totalProtein)}g protein
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onAddFood}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {entries.length > 0 && (
        <div className="border-t border-border">
          {entries.map((entry) =>
            entry.id && editingId === entry.id && edit ? (
              <div key={entry.id} className="border-b border-border/50 p-3 last:border-0">
                <input
                  value={edit.foodName}
                  onChange={(e) => setEdit({ ...edit, foodName: e.target.value })}
                  className="mb-2 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="grid grid-cols-5 gap-1.5">
                  {([
                    ['servings', 'srv'],
                    ['calories', 'cal'],
                    ['protein', 'P'],
                    ['carbs', 'C'],
                    ['fat', 'F'],
                  ] as const).map(([key, label]) => (
                    <div key={key}>
                      <input
                        type="number"
                        value={edit[key]}
                        onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
                        className="w-full rounded border border-border bg-background px-1.5 py-1 text-center text-xs outline-none focus:ring-1 focus:ring-ring"
                      />
                      <div className="mt-0.5 text-center text-[9px] text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={saveEdit}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex items-center justify-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={entry.id}
                className="flex items-center gap-3 border-b border-border/50 px-4 py-2.5 last:border-0"
              >
                <div className="flex-1">
                  <div className="text-sm">{entry.foodName}</div>
                  <div className="text-xs text-muted-foreground">
                    {entry.servings}x &middot; {Math.round(entry.calories)} cal
                  </div>
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>{Math.round(entry.protein)}P</span>
                  <span>{Math.round(entry.carbs)}C</span>
                  <span>{Math.round(entry.fat)}F</span>
                </div>
                <button
                  onClick={() => startEdit(entry)}
                  className="text-muted-foreground hover:text-primary"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => entry.id && onDeleteEntry(entry.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
