'use client';

import { useState } from 'react';
import { Smartphone, CheckCircle2, AlertCircle, Plus, Pencil, X } from 'lucide-react';
import { addDailyActivity, updateDailyActivity } from '@/lib/stores/analytics-store';
import { toDateString } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/shared/date-picker';
import type { DailyActivity } from '@/types';

interface SyncStatusProps {
  lastSyncDate?: string;
  apiKey?: string;
  activities?: DailyActivity[];
  onChanged?: () => void;
}

export function SyncStatus({ lastSyncDate, apiKey, activities = [], onChanged }: SyncStatusProps) {
  const [showManual, setShowManual] = useState(false);
  const [manualDate, setManualDate] = useState(toDateString());
  const [manualSteps, setManualSteps] = useState('');
  const [manualCalories, setManualCalories] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editSteps, setEditSteps] = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const isRecent = lastSyncDate && (
    new Date().getTime() - new Date(lastSyncDate).getTime() < 48 * 60 * 60 * 1000
  );

  const recentManual = [...activities]
    .filter((a) => a.source === 'manual')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const handleManualSave = async () => {
    setSaving(true);
    try {
      await addDailyActivity({
        date: manualDate,
        steps: parseInt(manualSteps) || 0,
        activeCalories: parseInt(manualCalories) || 0,
        source: 'manual',
      });
      setShowManual(false);
      setManualDate(toDateString());
      setManualSteps('');
      setManualCalories('');
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (activity: DailyActivity) => {
    setEditingDate(activity.date);
    setEditDate(activity.date);
    setEditSteps(String(activity.steps));
    setEditCalories(String(activity.activeCalories));
  };

  const cancelEdit = () => setEditingDate(null);

  const handleEditSave = async () => {
    if (!editingDate) return;
    setEditSaving(true);
    try {
      await updateDailyActivity(editingDate, {
        date: editDate,
        steps: parseInt(editSteps) || 0,
        activeCalories: parseInt(editCalories) || 0,
        source: 'manual',
      });
      setEditingDate(null);
      onChanged?.();
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full',
            isRecent ? 'bg-success/10' : lastSyncDate ? 'bg-warning/10' : 'bg-muted'
          )}>
            <Smartphone className={cn(
              'h-5 w-5',
              isRecent ? 'text-success' : lastSyncDate ? 'text-warning' : 'text-muted-foreground'
            )} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Apple Health Sync</h3>
            {lastSyncDate ? (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {isRecent ? (
                  <CheckCircle2 className="h-3 w-3 text-success" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-warning" />
                )}
                Last sync: {new Date(lastSyncDate).toLocaleDateString()}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Not configured</p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowManual(!showManual)}
          className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
        >
          <Plus className="h-3 w-3" />
          Manual Entry
        </button>
      </div>

      {showManual && (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-background p-3">
          <h4 className="text-sm font-medium">Add Activity</h4>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Date</label>
            <DatePicker value={manualDate} onChange={setManualDate} maxDate={toDateString()} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Steps</label>
              <input
                type="number"
                value={manualSteps}
                onChange={(e) => setManualSteps(e.target.value)}
                placeholder="e.g. 8500"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Active Calories</label>
              <input
                type="number"
                value={manualCalories}
                onChange={(e) => setManualCalories(e.target.value)}
                placeholder="e.g. 350"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <button
            onClick={handleManualSave}
            disabled={saving}
            className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {saving ? 'Saving...' : 'Save Activity'}
          </button>
        </div>
      )}

      {recentManual.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">Recent Manual Entries</h4>
          {recentManual.map((activity) => (
            <div key={activity.date} className="rounded-lg border border-border bg-background p-2.5">
              {editingDate === activity.date ? (
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Date</label>
                    <DatePicker value={editDate} onChange={setEditDate} maxDate={toDateString()} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Steps</label>
                      <input
                        type="number"
                        value={editSteps}
                        onChange={(e) => setEditSteps(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Active Calories</label>
                      <input
                        type="number"
                        value={editCalories}
                        onChange={(e) => setEditCalories(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleEditSave}
                      disabled={editSaving}
                      className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      {editSaving ? 'Saving...' : 'Save'}
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
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{new Date(activity.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                    <div className="text-xs text-muted-foreground">
                      {activity.steps.toLocaleString()} steps &middot; {activity.activeCalories} cal
                    </div>
                  </div>
                  <button
                    onClick={() => startEdit(activity)}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!apiKey && (
        <div className="mt-3 rounded-lg bg-muted p-3">
          <p className="text-xs text-muted-foreground">
            Set up automatic Apple Health sync via iOS Shortcuts in{' '}
            <a href="/settings/health-sync" className="font-medium text-primary underline">Settings</a>.
          </p>
        </div>
      )}
    </div>
  );
}
