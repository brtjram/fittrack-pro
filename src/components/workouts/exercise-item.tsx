'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Info, TrendingUp } from 'lucide-react';
import type { WorkoutExercise, WorkoutSet } from '@/types';
import { SetLogger } from './set-logger';
import { cn } from '@/lib/utils';

interface ExerciseItemProps {
  exercise: WorkoutExercise;
  onUpdateSets: (sets: WorkoutSet[]) => void;
  progressionNote?: string;
}

export function ExerciseItem({ exercise, onUpdateSets, progressionNote }: ExerciseItemProps) {
  const [expanded, setExpanded] = useState(true);

  const completedSets = exercise.sets.filter((s) => s.completed).length;
  const totalSets = exercise.sets.length;

  const handleSetUpdate = (index: number, updatedSet: WorkoutSet) => {
    const newSets = [...exercise.sets];
    newSets[index] = updatedSet;
    onUpdateSets(newSets);
  };

  const addSet = () => {
    const lastSet = exercise.sets[exercise.sets.length - 1];
    onUpdateSets([
      ...exercise.sets,
      {
        setNumber: exercise.sets.length + 1,
        targetReps: lastSet?.targetReps ?? 10,
        targetWeight: lastSet?.targetWeight ?? 0,
        completed: false,
      },
    ]);
  };

  const deleteSet = (index: number) => {
    if (exercise.sets.length <= 1) return;
    const newSets = exercise.sets
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, setNumber: i + 1 }));
    onUpdateSets(newSets);
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Exercise Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-4"
      >
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{exercise.exerciseName}</h3>
            {progressionNote && (
              <div className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                <TrendingUp className="h-3 w-3" />
                <span>+</span>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {completedSets}/{totalSets} sets &middot; Rest {exercise.restSeconds}s
          </p>
        </div>
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
          completedSets === totalSets
            ? 'bg-success/10 text-success'
            : 'bg-muted text-muted-foreground'
        )}>
          {completedSets === totalSets ? (
            <span className="text-xs">Done</span>
          ) : (
            expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* Progression Note */}
      {progressionNote && expanded && (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg bg-primary/5 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs text-primary">{progressionNote}</p>
        </div>
      )}

      {/* Sets */}
      {expanded && (
        <div className="space-y-2 px-4 pb-4">
          <div className="flex items-center gap-3 px-3 text-xs font-medium text-muted-foreground">
            <span className="w-6 text-center">Set</span>
            <span className="flex-1 text-center">Weight</span>
            <span className="flex-1 text-center">Reps</span>
            <span className="w-8" />
            {exercise.sets.length > 1 && <span className="w-8" />}
          </div>
          {exercise.sets.map((set, i) => (
            <SetLogger
              key={i}
              set={set}
              onUpdate={(s) => handleSetUpdate(i, s)}
              onDelete={exercise.sets.length > 1 ? () => deleteSet(i) : undefined}
            />
          ))}
          <button
            onClick={addSet}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="h-4 w-4" />
            Add Set
          </button>
        </div>
      )}
    </div>
  );
}
