'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, X, ScanBarcode, BookOpen, Loader2, Minus } from 'lucide-react';
import { foods, searchFoods } from '@/lib/data/foods';
import type { FoodItem, MealType } from '@/types';
import { cn } from '@/lib/utils';

interface FoodSearchProps {
  meal: MealType;
  onSelect: (food: FoodItem, servings: number) => void;
  onClose: () => void;
}

type FoodResult = FoodItem & { source?: 'local' | 'usda' | 'openfoodfacts'; barcode?: string };

export function FoodSearch({ meal, onSelect, onClose }: FoodSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodResult | null>(null);
  const [servings, setServings] = useState(1);
  const [servingsStr, setServingsStr] = useState('1');
  const servingsFocused = useRef(false);
  const [apiResults, setApiResults] = useState<FoodResult[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Local results (instant)
  const localResults: FoodResult[] = useMemo(() => {
    const raw = !query.trim() ? foods.slice(0, 10) : searchFoods(query);
    return raw.map((f) => ({ ...f, source: 'local' as const }));
  }, [query]);

  // Debounced API search (USDA + Open Food Facts combined)
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setApiResults([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setApiLoading(true);
      try {
        const res = await fetch(`/api/food-search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setApiResults(data.map((f: FoodResult) => ({ ...f, source: f.source ?? 'usda' })));
        }
      } catch {
        setApiResults([]);
      } finally {
        setApiLoading(false);
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Merge local + API, deduplicating by name similarity
  const results: FoodResult[] = useMemo(() => {
    if (!query.trim()) return localResults;

    // Show local matches first, then API results
    const seen = new Set<string>();
    const merged: FoodResult[] = [];

    for (const food of localResults) {
      const key = food.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(food);
      }
    }

    for (const food of apiResults) {
      const key = food.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(food);
      }
    }

    return merged;
  }, [query, localResults, apiResults]);

  const handleConfirm = () => {
    if (selectedFood) {
      onSelect(selectedFood, servings);
      setSelectedFood(null);
      setServings(1);
      setQuery('');
    }
  };

  // ==================== Barcode Scanner ====================

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const lookupBarcode = useCallback(async (code: string) => {
    setScanLoading(true);
    setScanError('');
    try {
      const res = await fetch(`/api/food-barcode?code=${encodeURIComponent(code)}`);
      if (!res.ok) {
        setScanError('Product not found. Try searching by name instead.');
        setScanLoading(false);
        return;
      }
      const food: FoodResult = await res.json();
      food.source = 'openfoodfacts';
      stopCamera();
      setScannerOpen(false);
      setSelectedFood(food);
      setServings(1);
    } catch {
      setScanError('Failed to look up barcode. Please try again.');
    } finally {
      setScanLoading(false);
    }
  }, [stopCamera]);

  const startScanner = useCallback(async () => {
    setScannerOpen(true);
    setScanError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;

      // Wait for video element to mount
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Use BarcodeDetector API if available
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'],
        });

        const detect = async () => {
          if (!videoRef.current || !streamRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              if (code) {
                await lookupBarcode(code);
                return;
              }
            }
          } catch { /* detection frame failed, retry */ }
          if (streamRef.current) {
            requestAnimationFrame(detect);
          }
        };
        requestAnimationFrame(detect);
      } else {
        setScanError('Barcode scanning requires Chrome 83+ or Safari 16.4+. You can enter the barcode number manually.');
      }
    } catch {
      setScanError('Camera access denied. Please allow camera access and try again.');
    }
  }, [lookupBarcode]);

  const closeScannerAndCleanup = useCallback(() => {
    stopCamera();
    setScannerOpen(false);
    setScanError('');
  }, [stopCamera]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const sourceLabel = (source?: string) => {
    switch (source) {
      case 'usda': return 'USDA';
      case 'openfoodfacts': return 'OFF';
      default: return null;
    }
  };

  const sourceColor = (source?: string) => {
    switch (source) {
      case 'usda': return 'bg-blue-500/10 text-blue-600';
      case 'openfoodfacts': return 'bg-green-500/10 text-green-600';
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <h2 className="flex-1 font-semibold capitalize">Add to {meal}</h2>
        <button
          onClick={startScanner}
          className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          <ScanBarcode className="h-4 w-4" />
          Scan
        </button>
      </div>

      {/* Barcode Scanner Modal */}
      {scannerOpen && (
        <div className="absolute inset-0 z-60 flex flex-col bg-background">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <button onClick={closeScannerAndCleanup} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
            <h2 className="flex-1 font-semibold">Scan Barcode</h2>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
            <div className="relative w-full max-w-sm overflow-hidden rounded-xl border-2 border-primary/30">
              <video
                ref={videoRef}
                className="w-full"
                playsInline
                muted
              />
              {/* Scanning guide overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-24 w-64 rounded border-2 border-primary/50" />
              </div>
            </div>

            {scanLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Looking up product...
              </div>
            )}

            {scanError && (
              <p className="text-center text-sm text-destructive">{scanError}</p>
            )}

            {/* Manual barcode entry */}
            <div className="w-full max-w-sm">
              <p className="mb-2 text-center text-xs text-muted-foreground">
                Or enter barcode manually:
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = (e.target as HTMLFormElement).elements.namedItem('barcode') as HTMLInputElement;
                  if (input.value.trim()) lookupBarcode(input.value.trim());
                }}
                className="flex gap-2"
              >
                <input
                  name="barcode"
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 5901234123457"
                  className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Look up
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods across all databases..."
            className="flex-1 bg-transparent py-2 text-sm outline-none"
            autoFocus
          />
          {apiLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
          <BookOpen className="h-3 w-3" />
          <span>Searches common foods, USDA (300k+), and Open Food Facts (3M+ branded products) simultaneously</span>
        </div>
      </div>

      {/* Selected Food Detail */}
      {selectedFood && (
        <div className="border-b border-border bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{selectedFood.name}</h3>
            {sourceLabel(selectedFood.source) && (
              <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', sourceColor(selectedFood.source))}>
                {sourceLabel(selectedFood.source)}
              </span>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {/* Quick-select portion buttons */}
            <div className="flex gap-1.5">
              {[0.5, 1, 1.5, 2, 3].map((q) => (
                <button
                  key={q}
                  onClick={() => { setServings(q); setServingsStr(String(q)); }}
                  className={cn(
                    'flex-1 rounded border py-1 text-xs font-medium transition-colors',
                    servings === q
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  )}
                >
                  {q}×
                </button>
              ))}
            </div>
            {/* Fine-tune stepper */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Servings:</label>
              <button
                onClick={() => { const v = Math.max(0.25, servings - 0.25); setServings(v); setServingsStr(String(v)); }}
                className="rounded border border-border p-1 hover:bg-accent"
              >
                <Minus className="h-3 w-3" />
              </button>
              <input
                type="text"
                inputMode="decimal"
                value={servingsStr}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                  setServingsStr(raw);
                  const n = parseFloat(raw);
                  if (!isNaN(n) && n > 0) setServings(n);
                }}
                onBlur={() => {
                  servingsFocused.current = false;
                  const n = parseFloat(servingsStr);
                  const clean = isNaN(n) || n <= 0 ? 0.25 : n;
                  setServings(clean);
                  setServingsStr(String(clean));
                }}
                onFocus={(e) => { servingsFocused.current = true; e.target.select(); }}
                className="w-14 rounded border border-border bg-background px-2 py-1 text-center text-sm outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={() => { const v = servings + 0.25; setServings(v); setServingsStr(String(v)); }}
                className="rounded border border-border p-1 hover:bg-accent"
              >
                <Plus className="h-3 w-3" />
              </button>
              <span className="text-xs text-muted-foreground">
                ({Math.round(selectedFood.servingSizeG * servings)}g)
              </span>
            </div>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span>{Math.round(selectedFood.caloriesPer100g * selectedFood.servingSizeG * servings / 100)} cal</span>
            <span>{Math.round(selectedFood.proteinPer100g * selectedFood.servingSizeG * servings / 100)}g P</span>
            <span>{Math.round(selectedFood.carbsPer100g * selectedFood.servingSizeG * servings / 100)}g C</span>
            <span>{Math.round(selectedFood.fatPer100g * selectedFood.servingSizeG * servings / 100)}g F</span>
          </div>
          <button
            onClick={handleConfirm}
            className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add to {meal}
          </button>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {apiLoading && results.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Searching databases...</span>
          </div>
        )}

        {!apiLoading && query.length >= 2 && results.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm text-muted-foreground">No results found.</p>
            <button
              onClick={startScanner}
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ScanBarcode className="h-4 w-4" />
              Try scanning the barcode instead
            </button>
          </div>
        )}

        {results.map((food) => (
          <button
            key={food.id}
            onClick={() => { setSelectedFood(food); setServings(1); }}
            className={cn(
              'flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent',
              selectedFood?.id === food.id && 'bg-primary/5'
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium truncate">{food.name}</span>
                {sourceLabel(food.source) && (
                  <span className={cn('shrink-0 rounded px-1 py-0.5 text-[9px] font-medium', sourceColor(food.source))}>
                    {sourceLabel(food.source)}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {food.servingLabel} ({food.servingSizeG}g) &middot;{' '}
                {Math.round(food.caloriesPer100g * food.servingSizeG / 100)} cal
              </div>
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground shrink-0">
              <span className="text-blue-500">{Math.round(food.proteinPer100g * food.servingSizeG / 100)}P</span>
              <span className="text-amber-500">{Math.round(food.carbsPer100g * food.servingSizeG / 100)}C</span>
              <span className="text-red-400">{Math.round(food.fatPer100g * food.servingSizeG / 100)}F</span>
            </div>
            <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
