'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Upload, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  parseCsv,
  detectColumnMapping,
  buildImportRows,
  type ColumnField,
  type ParsedImportRow,
} from '@/lib/utils/csv-parser';

const FIELD_LABELS: Record<ColumnField, string> = {
  date: 'Date',
  weight: 'Weight',
  calories: 'Calories',
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
  ignore: '(ignore)',
};

export default function MacroFactorImportPage() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnField[]>([]);
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ weightRowsImported: number; nutritionRowsImported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setResult(null);
    setFileName(file.name);

    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) {
      setError('Could not find any data rows in this file.');
      return;
    }

    const [headerRow, ...rows] = parsed;
    setHeaders(headerRow);
    setDataRows(rows);
    setMapping(detectColumnMapping(headerRow));
  };

  const preview: ParsedImportRow[] = dataRows.length > 0 ? buildImportRows(dataRows.slice(0, 5), mapping, weightUnit).rows : [];

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    try {
      const { rows, skipped } = buildImportRows(dataRows, mapping, weightUnit);
      if (rows.length === 0) {
        setError('No usable rows found — check the column mapping below.');
        return;
      }
      const res = await fetch('/api/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, source: 'MacroFactor' }),
      });
      if (!res.ok) throw new Error('Import failed.');
      const data = await res.json();
      setResult({ ...data, skipped });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header title="Import CSV Data" showBack />

      <div className="mx-auto max-w-lg space-y-6 p-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            MacroFactor doesn&apos;t have a live API, so this is a one-time import: export your data from{' '}
            <strong>MacroFactor → Settings → Export Data</strong>, then upload the CSV here. This works with any
            similarly-shaped export (MyFitnessPal, Cronometer, etc) — columns are auto-detected and you can
            correct the mapping before anything is saved.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border py-8 text-center hover:border-primary/50">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium">{fileName || 'Choose a CSV file'}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        </div>

        {headers.length > 0 && (
          <>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 font-semibold">Column mapping</h3>
              <div className="space-y-2">
                {headers.map((header, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-muted-foreground" title={header}>{header}</span>
                    <select
                      value={mapping[i]}
                      onChange={(e) => setMapping((prev) => prev.map((f, idx) => (idx === i ? (e.target.value as ColumnField) : f)))}
                      className="rounded-lg border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      {Object.entries(FIELD_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {mapping.includes('weight') && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Weight unit:</span>
                  {(['lbs', 'kg'] as const).map((u) => (
                    <button
                      key={u}
                      onClick={() => setWeightUnit(u)}
                      className={cn(
                        'rounded-lg border px-3 py-1 text-sm',
                        weightUnit === u ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground',
                      )}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {preview.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-3 font-semibold">Preview (first {preview.length} rows)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="pr-3 pb-1">Date</th>
                        <th className="pr-3 pb-1">Weight</th>
                        <th className="pr-3 pb-1">Cal</th>
                        <th className="pr-3 pb-1">P</th>
                        <th className="pr-3 pb-1">C</th>
                        <th className="pb-1">F</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="py-1 pr-3">{row.date}</td>
                          <td className="py-1 pr-3">{row.weightLbs ?? '—'}</td>
                          <td className="py-1 pr-3">{row.calories ?? '—'}</td>
                          <td className="py-1 pr-3">{row.protein ?? '—'}</td>
                          <td className="py-1 pr-3">{row.carbs ?? '—'}</td>
                          <td className="py-1">{row.fat ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={importing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {importing ? 'Importing…' : `Import ${dataRows.length} rows`}
            </button>
          </>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <div className="flex items-start gap-2 rounded-xl border border-success/30 bg-success/5 p-4 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <div>
              <div className="font-medium text-success">Import complete</div>
              <div className="mt-1 text-muted-foreground">
                {result.weightRowsImported} weight entries, {result.nutritionRowsImported} nutrition days imported
                {result.skipped > 0 && `, ${result.skipped} rows skipped (no valid date/data)`}.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
