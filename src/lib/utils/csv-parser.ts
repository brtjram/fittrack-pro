// Generic, tolerant CSV parsing for third-party exports (MacroFactor, MyFitnessPal,
// Cronometer, etc). Export formats aren't standardized or guaranteed stable, so this
// auto-detects likely columns but always leaves the user able to remap and preview
// before anything is imported, rather than assuming one fixed schema.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') { inQuotes = true; }
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
  }

  return rows;
}

export type ColumnField = 'date' | 'weight' | 'calories' | 'protein' | 'carbs' | 'fat' | 'ignore';

const CANDIDATES: Record<Exclude<ColumnField, 'ignore'>, string[]> = {
  date: ['date', 'day', 'log date', 'logdate'],
  weight: ['weight', 'bodyweight', 'body weight', 'weight (lbs)', 'weight (kg)', 'weight lbs', 'weight kg'],
  calories: ['calories', 'kcal', 'energy', 'calories (kcal)', 'total calories'],
  protein: ['protein', 'protein (g)', 'protein g'],
  carbs: ['carbs', 'carbohydrates', 'carbohydrate', 'carbs (g)', 'carb (g)'],
  fat: ['fat', 'fat (g)', 'total fat'],
};

export function detectColumnMapping(headers: string[]): ColumnField[] {
  return headers.map((header) => {
    const normalized = header.trim().toLowerCase();
    for (const [field, candidates] of Object.entries(CANDIDATES) as [Exclude<ColumnField, 'ignore'>, string[]][]) {
      if (candidates.includes(normalized)) return field;
    }
    return 'ignore';
  });
}

export interface ParsedImportRow {
  date: string;
  weightLbs?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

// Normalizes a variety of common export date formats to YYYY-MM-DD.
export function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);

  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];

  return null;
}

export function buildImportRows(
  dataRows: string[][],
  mapping: ColumnField[],
  weightUnit: 'lbs' | 'kg',
): { rows: ParsedImportRow[]; skipped: number } {
  const rows: ParsedImportRow[] = [];
  let skipped = 0;

  for (const raw of dataRows) {
    const values: Partial<Record<ColumnField, string>> = {};
    mapping.forEach((field, i) => {
      if (field !== 'ignore' && raw[i] !== undefined) values[field] = raw[i];
    });

    const date = values.date ? normalizeDate(values.date) : null;
    if (!date) { skipped++; continue; }

    const weightRaw = values.weight ? Number(values.weight) : undefined;
    const weightLbs = weightRaw && Number.isFinite(weightRaw)
      ? (weightUnit === 'kg' ? weightRaw * 2.20462 : weightRaw)
      : undefined;

    const calories = values.calories ? Number(values.calories) : undefined;
    const protein = values.protein ? Number(values.protein) : undefined;
    const carbs = values.carbs ? Number(values.carbs) : undefined;
    const fat = values.fat ? Number(values.fat) : undefined;

    if (weightLbs === undefined && !Number.isFinite(calories)) { skipped++; continue; }

    rows.push({
      date,
      ...(weightLbs !== undefined && { weightLbs: Math.round(weightLbs * 10) / 10 }),
      ...(Number.isFinite(calories) && { calories: Math.round(calories!) }),
      ...(Number.isFinite(protein) && { protein: Math.round(protein!) }),
      ...(Number.isFinite(carbs) && { carbs: Math.round(carbs!) }),
      ...(Number.isFinite(fat) && { fat: Math.round(fat!) }),
    });
  }

  return { rows, skipped };
}
