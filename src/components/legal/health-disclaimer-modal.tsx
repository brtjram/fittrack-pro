'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, X } from 'lucide-react';

const STORAGE_KEY = 'fittrack_health_disclaimer_v1';

export function HealthDisclaimerModal() {
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // localStorage unavailable (SSR guard)
    }
  }, []);

  const accept = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center">
      <div className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
            <ShieldAlert className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Health &amp; Safety Notice</h2>
            <p className="text-xs text-muted-foreground">Please read before using FitTrack Pro</p>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-3 px-5 py-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            FitTrack Pro provides <strong className="text-foreground">general fitness and nutrition guidance</strong> based on
            your self-reported information. It is <strong className="text-foreground">not a medical device</strong> and does not
            provide medical advice, diagnosis, or treatment.
          </p>

          <ul className="space-y-1.5 pl-4 list-disc">
            <li>Consult a qualified physician or healthcare provider before beginning any new exercise or nutrition programme, especially if you have a pre-existing medical condition, injury, or are pregnant.</li>
            <li>AI-generated coaching suggestions are illustrative — they are not a substitute for personalised advice from a certified personal trainer or registered dietitian.</li>
            <li>Stop exercising and seek medical attention if you experience chest pain, severe shortness of breath, dizziness, or any unusual symptoms.</li>
            <li>Workout loads and calorie targets are estimates. You are responsible for adjusting intensity to suit your body.</li>
          </ul>

          <p>
            By using this app you acknowledge these limitations and agree to our{' '}
            <a href="/terms" target="_blank" className="font-medium text-primary underline-offset-2 hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" target="_blank" className="font-medium text-primary underline-offset-2 hover:underline">Privacy Policy</a>.
          </p>
        </div>

        {/* Checkbox + button */}
        <div className="border-t border-border px-5 py-4 space-y-3">
          <label className="flex cursor-pointer items-start gap-3">
            <div className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="peer h-5 w-5 cursor-pointer appearance-none rounded border-2 border-border bg-background checked:border-primary checked:bg-primary transition-colors"
              />
              {checked && (
                <svg className="pointer-events-none absolute h-3 w-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span className="text-sm text-muted-foreground leading-snug">
              I understand this app is not a substitute for professional medical advice and I exercise at my own risk.
            </span>
          </label>

          <button
            onClick={accept}
            disabled={!checked}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            I Understand — Continue to FitTrack Pro
          </button>
        </div>
      </div>
    </div>
  );
}
