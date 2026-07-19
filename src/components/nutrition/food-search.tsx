'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, X, ScanBarcode, BookOpen, Loader2, Minus, Camera, Upload, Clock, Sparkles, Check, Pencil } from 'lucide-react';
import { foods, searchFoods } from '@/lib/data/foods';
import type { FoodItem, MealType } from '@/types';
import { cn, generateId } from '@/lib/utils';
import { resizeImageToBase64 } from '@/lib/utils/image-resize';

interface FoodSearchProps {
  meal: MealType;
  onSelect: (food: FoodItem, servings: number) => void;
  onSelectMultiple?: (items: Array<{ food: FoodItem; servings: number }>) => void;
  onClose: () => void;
}

type FoodResult = FoodItem & { source?: 'local' | 'usda' | 'openfoodfacts' | 'recent'; barcode?: string };

interface AnalyzedItem {
  id: string;
  name: string;
  servingDescription: string;
  servingSizeG: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: 'high' | 'medium' | 'low';
  included: boolean;
}

export function FoodSearch({ meal, onSelect, onSelectMultiple, onClose }: FoodSearchProps) {
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

  // Recent/frequent foods — shown before the user types anything, same idea
  // as MacroFactor's zero-query defaults (favorites/hourly go-tos/recent).
  const [recentFoods, setRecentFoods] = useState<FoodResult[]>([]);

  useEffect(() => {
    fetch(`/api/fitness/food-log/recent?meal=${meal}&limit=10`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: FoodResult[]) => setRecentFoods(data.map((f) => ({ ...f, source: 'recent' as const }))))
      .catch(() => setRecentFoods([]));
  }, [meal]);

  // ==================== Photo food logging ====================
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoCameraOpen, setPhotoCameraOpen] = useState(false);
  const photoVideoRef = useRef<HTMLVideoElement>(null);
  const photoStreamRef = useRef<MediaStream | null>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoDescription, setPhotoDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [analyzedItems, setAnalyzedItems] = useState<AnalyzedItem[] | null>(null);
  const [analyzedNotes, setAnalyzedNotes] = useState<string | null>(null);
  const pendingImageRef = useRef<{ base64: string; mediaType: string } | null>(null);

  // Local results (instant)
  const localResults: FoodResult[] = useMemo(() => {
    if (!query.trim()) return recentFoods.length > 0 ? recentFoods : foods.slice(0, 10).map((f) => ({ ...f, source: 'local' as const }));
    return searchFoods(query).map((f) => ({ ...f, source: 'local' as const }));
  }, [query, recentFoods]);

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
    return () => { stopCamera(); stopPhotoCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopCamera]);

  const sourceLabel = (source?: string) => {
    switch (source) {
      case 'usda': return 'USDA';
      case 'openfoodfacts': return 'OFF';
      case 'recent': return null;
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

  // ==================== Photo food logging ====================

  const resetPhotoState = useCallback(() => {
    setPhotoPreviewUrl(null);
    setPhotoDescription('');
    setAnalyzeError('');
    setAnalyzedItems(null);
    setAnalyzedNotes(null);
    pendingImageRef.current = null;
  }, []);

  const stopPhotoCamera = useCallback(() => {
    if (photoStreamRef.current) {
      photoStreamRef.current.getTracks().forEach((t) => t.stop());
      photoStreamRef.current = null;
    }
    setPhotoCameraOpen(false);
  }, []);

  const openPhotoModal = useCallback(() => {
    resetPhotoState();
    setPhotoModalOpen(true);
  }, [resetPhotoState]);

  const closePhotoModal = useCallback(() => {
    stopPhotoCamera();
    setPhotoModalOpen(false);
    resetPhotoState();
  }, [stopPhotoCamera, resetPhotoState]);

  const startPhotoCamera = useCallback(async () => {
    setAnalyzeError('');
    setPhotoCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      photoStreamRef.current = stream;
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (photoVideoRef.current) {
        photoVideoRef.current.srcObject = stream;
        await photoVideoRef.current.play();
      }
    } catch {
      setAnalyzeError('Camera access denied. Please allow camera access, or upload a photo instead.');
      setPhotoCameraOpen(false);
    }
  }, []);

  const setPendingImageFromBlob = useCallback(async (blob: Blob) => {
    const resized = await resizeImageToBase64(blob);
    pendingImageRef.current = resized;
    setPhotoPreviewUrl(`data:${resized.mediaType};base64,${resized.base64}`);
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!photoVideoRef.current || !photoCanvasRef.current) return;
    const video = photoVideoRef.current;
    const canvas = photoCanvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (blob) await setPendingImageFromBlob(blob);
      stopPhotoCamera();
    }, 'image/jpeg', 0.9);
  }, [setPendingImageFromBlob, stopPhotoCamera]);

  const handleFileSelected = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setAnalyzeError('');
    try {
      await setPendingImageFromBlob(file);
    } catch {
      setAnalyzeError('Could not read that image. Please try a different photo.');
    }
  }, [setPendingImageFromBlob]);

  const analyzePhoto = useCallback(async () => {
    if (!pendingImageRef.current) return;
    setAnalyzing(true);
    setAnalyzeError('');
    setAnalyzedItems(null);
    try {
      const res = await fetch('/api/fitness/food-log/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: pendingImageRef.current.base64,
          mediaType: pendingImageRef.current.mediaType,
          description: photoDescription.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAnalyzeError(err.error || 'Could not analyze this photo. Please try again.');
        return;
      }
      const data = await res.json() as { items: Omit<AnalyzedItem, 'id' | 'included'>[]; notes?: string };
      setAnalyzedItems(data.items.map((item) => ({ ...item, id: generateId(), included: true })));
      setAnalyzedNotes(data.notes ?? null);
    } catch {
      setAnalyzeError('Could not analyze this photo. Please check your connection and try again.');
    } finally {
      setAnalyzing(false);
    }
  }, [photoDescription]);

  const updateAnalyzedItem = (id: string, patch: Partial<AnalyzedItem>) => {
    setAnalyzedItems((prev) => prev?.map((item) => (item.id === id ? { ...item, ...patch } : item)) ?? null);
  };

  const confirmAnalyzedItems = () => {
    if (!analyzedItems) return;
    const toLog = analyzedItems.filter((item) => item.included);
    if (toLog.length === 0) return;

    const asFood = (item: AnalyzedItem): FoodItem => ({
      id: `photo-${item.id}`,
      name: item.name,
      caloriesPer100g: item.servingSizeG > 0 ? (item.calories / item.servingSizeG) * 100 : item.calories,
      proteinPer100g: item.servingSizeG > 0 ? (item.protein / item.servingSizeG) * 100 : item.protein,
      carbsPer100g: item.servingSizeG > 0 ? (item.carbs / item.servingSizeG) * 100 : item.carbs,
      fatPer100g: item.servingSizeG > 0 ? (item.fat / item.servingSizeG) * 100 : item.fat,
      servingSizeG: item.servingSizeG || 1,
      servingLabel: item.servingDescription,
      category: 'photo',
    });

    if (onSelectMultiple) {
      onSelectMultiple(toLog.map((item) => ({ food: asFood(item), servings: 1 })));
    } else {
      toLog.forEach((item) => onSelect(asFood(item), 1));
    }
    closePhotoModal();
  };

  return (
    // z-70: must clear the persistent chrome (floating-nav, chat-widget both
    // sit at z-50) — otherwise, on a z-index tie, whichever renders later in
    // the DOM wins the stack regardless of this component's own nested
    // z-index, and the bottom nav/chat bubble paint over this modal's
    // buttons instead of behind them.
    <div className="fixed inset-0 z-70 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <h2 className="flex-1 font-semibold capitalize">Add to {meal}</h2>
        <button
          onClick={openPhotoModal}
          className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          <Camera className="h-4 w-4" />
          Photo
        </button>
        <button
          onClick={startScanner}
          className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          <ScanBarcode className="h-4 w-4" />
          Scan
        </button>
      </div>

      {/* Photo Food Logging Modal */}
      {photoModalOpen && (
        <div className="absolute inset-0 z-80 flex flex-col bg-background">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <button onClick={closePhotoModal} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
            <h2 className="flex-1 font-semibold">Log with Photo</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Live camera capture */}
            {photoCameraOpen && (
              <div className="mb-4 flex flex-col items-center gap-3">
                <div className="relative w-full max-w-sm overflow-hidden rounded-xl border-2 border-primary/30">
                  <video ref={photoVideoRef} className="w-full" playsInline muted />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={capturePhoto}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Camera className="h-4 w-4" />
                    Capture
                  </button>
                  <button
                    onClick={stopPhotoCamera}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <canvas ref={photoCanvasRef} className="hidden" />

            {/* Capture / upload entry points */}
            {!photoCameraOpen && !photoPreviewUrl && !analyzedItems && (
              <div className="flex flex-col items-center gap-4 py-6">
                <Sparkles className="h-8 w-8 text-primary" />
                <p className="max-w-xs text-center text-sm text-muted-foreground">
                  Take or upload a photo of your meal and the AI coach will estimate what&apos;s in it and how many calories/macros it has.
                </p>
                <div className="flex w-full max-w-xs flex-col gap-2">
                  <button
                    onClick={startPhotoCamera}
                    className="flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Camera className="h-4 w-4" />
                    Take Photo
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 rounded-lg border border-border py-3 text-sm font-medium text-muted-foreground hover:bg-accent"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Photo
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelected(e.target.files?.[0])}
                  />
                </div>
              </div>
            )}

            {/* Preview + description + analyze */}
            {photoPreviewUrl && !analyzedItems && (
              <div className="flex flex-col gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreviewUrl} alt="Meal preview" className="max-h-64 w-full rounded-xl object-cover" />
                <textarea
                  value={photoDescription}
                  onChange={(e) => setPhotoDescription(e.target.value)}
                  placeholder='Optional: add context (e.g. "grilled, no oil" or "large portion")'
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex gap-2">
                  <button
                    onClick={analyzePhoto}
                    disabled={analyzing}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {analyzing ? 'Analyzing...' : 'Analyze Photo'}
                  </button>
                  <button
                    onClick={resetPhotoState}
                    disabled={analyzing}
                    className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
                  >
                    Retake
                  </button>
                </div>
                {analyzeError && <p className="text-sm text-destructive">{analyzeError}</p>}
              </div>
            )}

            {/* Analyzed items review */}
            {analyzedItems && (
              <div className="flex flex-col gap-3">
                {photoPreviewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreviewUrl} alt="Meal preview" className="max-h-40 w-full rounded-xl object-cover" />
                )}
                {analyzedNotes && (
                  <p className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">{analyzedNotes}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Review and adjust before logging — these are AI estimates, not exact measurements.
                </p>
                {analyzedItems.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => updateAnalyzedItem(item.id, { included: !item.included })}
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                          item.included ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                        )}
                      >
                        {item.included && <Check className="h-3 w-3" />}
                      </button>
                      <div className="flex-1">
                        <input
                          value={item.name}
                          onChange={(e) => updateAnalyzedItem(item.id, { name: e.target.value })}
                          className="w-full bg-transparent text-sm font-medium outline-none"
                        />
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Pencil className="h-2.5 w-2.5" />
                          <input
                            value={item.servingDescription}
                            onChange={(e) => updateAnalyzedItem(item.id, { servingDescription: e.target.value })}
                            className="flex-1 bg-transparent outline-none"
                          />
                          {item.confidence !== 'high' && (
                            <span className={cn(
                              'shrink-0 rounded px-1 py-0.5 text-[9px] font-medium',
                              item.confidence === 'low' ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'
                            )}>
                              {item.confidence} confidence
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1.5 pl-7">
                      {([
                        ['calories', 'cal'],
                        ['protein', 'P'],
                        ['carbs', 'C'],
                        ['fat', 'F'],
                      ] as const).map(([key, label]) => (
                        <div key={key}>
                          <input
                            type="number"
                            value={Math.round(item[key])}
                            onChange={(e) => updateAnalyzedItem(item.id, { [key]: Number(e.target.value) || 0 })}
                            className="w-full rounded border border-border bg-background px-1.5 py-1 text-center text-xs outline-none focus:ring-1 focus:ring-ring"
                          />
                          <div className="mt-0.5 text-center text-[9px] text-muted-foreground">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pinned footer — kept outside the scrollable review list so the
              Log/Retake buttons stay reachable and tappable no matter how
              many items the photo analysis returns (previously the last
              scroll or safe-area-inset-bottom on notched phones could
              swallow taps at the very bottom edge). */}
          {analyzedItems && (
            <div className="flex shrink-0 gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                onClick={confirmAnalyzedItems}
                disabled={!analyzedItems.some((i) => i.included)}
                className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Log {analyzedItems.filter((i) => i.included).length} item{analyzedItems.filter((i) => i.included).length === 1 ? '' : 's'} to {meal}
              </button>
              <button
                onClick={resetPhotoState}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent"
              >
                Retake
              </button>
            </div>
          )}
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {scannerOpen && (
        <div className="absolute inset-0 z-80 flex flex-col bg-background">
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

        {!query.trim() && recentFoods.length > 0 && (
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">
            <Clock className="h-3 w-3" />
            Recently logged
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
