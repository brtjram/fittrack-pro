'use client';

import { useState, useRef } from 'react';
import { Check, Minus, Plus, Trash2 } from 'lucide-react';
import type { WorkoutSet } from '@/types';
import { cn } from '@/lib/utils';

interface SetLoggerProps {
  set: WorkoutSet;
  onUpdate: (set: WorkoutSet) => void;
  onDelete?: () => void;
  isPR?: boolean;
}

export function SetLogger({ set, onUpdate, onDelete, isPR = false }: SetLoggerProps) {
  const weight = set.actualWeight ?? set.targetWeight;
  const reps = set.actualReps ?? set.targetReps;

  const [weightStr, setWeightStr] = useState(String(weight));
  const [repsStr, setRepsStr] = useState(String(reps));
  const weightFocused = useRef(false);
  const repsFocused = useRef(false);

  // Sync display strings when parent data changes (e.g. +/- buttons)
  if (Number(weightStr) !== weight && !weightFocused.current) {
    setWeightStr(String(weight));
  }
  if (Number(repsStr) !== reps && !repsFocused.current) {
    setRepsStr(String(reps));
  }

  const adjustWeight = (delta: number) => {
    const newVal = Math.max(0, weight + delta);
    setWeightStr(String(newVal));
    onUpdate({ ...set, actualWeight: newVal });
  };

  const adjustReps = (delta: number) => {
    const newVal = Math.max(0, reps + delta);
    setRepsStr(String(newVal));
    onUpdate({ ...set, actualReps: newVal });
  };

  const handleWeightChange = (val: string) => {
    setWeightStr(val);
    const num = Number(val);
    if (val !== '' && !isNaN(num)) {
      onUpdate({ ...set, actualWeight: num });
    }
  };

  const handleWeightBlur = () => {
    weightFocused.current = false;
    const num = Number(weightStr);
    const clean = isNaN(num) || weightStr === '' ? 0 : Math.max(0, num);
    setWeightStr(String(clean));
    onUpdate({ ...set, actualWeight: clean });
  };

  const handleRepsChange = (val: string) => {
    setRepsStr(val);
    const num = Number(val);
    if (val !== '' && !isNaN(num)) {
      onUpdate({ ...set, actualReps: num });
    }
  };

  const handleRepsBlur = () => {
    repsFocused.current = false;
    const num = Number(repsStr);
    const clean = isNaN(num) || repsStr === '' ? 0 : Math.max(0, num);
    setRepsStr(String(clean));
    onUpdate({ ...set, actualReps: clean });
  };

  const toggleComplete = () => {
    onUpdate({
      ...set,
      completed: !set.completed,
      actualWeight: weight,
      actualReps: reps,
    });
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 transition-colors',
        set.completed
          ? 'border-success/30 bg-success/5'
          : 'border-border',
        isPR && set.completed && 'border-warning/30 bg-warning/5'
      )}
    >
      <span className="w-6 text-center text-sm font-medium text-muted-foreground">
        {set.setNumber}
      </span>

      {/* Weight */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => adjustWeight(-5)}
          className="rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <Minus className="h-3 w-3" />
        </button>
        <input
          type="text"
          inputMode="decimal"
          data-field="weight"
          value={weightStr}
          onChange={(e) => handleWeightChange(e.target.value)}
          onBlur={handleWeightBlur}
          onFocus={(e) => { weightFocused.current = true; e.target.select(); }}
          className="w-16 rounded border border-border bg-background px-2 py-1 text-center text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={() => adjustWeight(5)}
          className="rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <Plus className="h-3 w-3" />
        </button>
        <span className="text-xs text-muted-foreground">lbs</span>
      </div>

      {/* Reps */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => adjustReps(-1)}
          className="rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <Minus className="h-3 w-3" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          data-field="reps"
          value={repsStr}
          onChange={(e) => handleRepsChange(e.target.value)}
          onBlur={handleRepsBlur}
          onFocus={(e) => { repsFocused.current = true; e.target.select(); }}
          className="w-12 rounded border border-border bg-background px-2 py-1 text-center text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={() => adjustReps(1)}
          className="rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <Plus className="h-3 w-3" />
        </button>
        <span className="text-xs text-muted-foreground">reps</span>
      </div>

      {/* Complete Button */}
      <button
        onClick={toggleComplete}
        className={cn(
          'ml-auto flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
          set.completed
            ? 'border-success bg-success text-white'
            : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
        )}
      >
        <Check className="h-4 w-4" />
      </button>

      {isPR && set.completed && (
        <span className="text-xs font-bold text-warning">PR!</span>
      )}

      {/* Delete Button */}
      {onDelete && (
        <button
          onClick={onDelete}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          title="Remove set"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
