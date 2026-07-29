import { NextRequest, NextResponse } from 'next/server';

const USDA_API_KEY = process.env.USDA_API_KEY || 'DEMO_KEY';
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';
const OFF_BASE = 'https://world.openfoodfacts.org';
const FATSECRET_CLIENT_ID = process.env.FATSECRET_CLIENT_ID;
const FATSECRET_CLIENT_SECRET = process.env.FATSECRET_CLIENT_SECRET;
const FATSECRET_TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const FATSECRET_SEARCH_URL = 'https://platform.fatsecret.com/rest/foods/search/v1';

// ==================== USDA ====================

interface USDAFood {
  fdcId: number;
  description: string;
  brandName?: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients: Array<{
    nutrientId?: number;
    nutrientName?: string;
    value?: number;
    unitName?: string;
  }>;
}

function extractNutrient(food: USDAFood, nutrientId: number): number {
  const n = food.foodNutrients.find((fn) => fn.nutrientId === nutrientId);
  return n?.value ?? 0;
}

async function searchUSDA(query: string) {
  try {
    const res = await fetch(
      `${USDA_BASE}/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=15&dataType=Foundation,SR Legacy,Branded`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const foods = (data.foods || []) as USDAFood[];

    return foods.map((food) => {
      const calories = extractNutrient(food, 1008);
      const protein = extractNutrient(food, 1003);
      const carbs = extractNutrient(food, 1005);
      const fat = extractNutrient(food, 1004);
      const fiber = extractNutrient(food, 1079);

      const servingSizeG = food.servingSize && food.servingSizeUnit?.toLowerCase() === 'g'
        ? food.servingSize
        : 100;

      const servingLabel = food.householdServingFullText || `${servingSizeG}g`;
      const brand = food.brandName || food.brandOwner;

      return {
        id: `usda-${food.fdcId}`,
        name: brand ? `${food.description} (${brand})` : food.description,
        source: 'usda' as const,
        caloriesPer100g: calories,
        proteinPer100g: protein,
        carbsPer100g: carbs,
        fatPer100g: fat,
        fiberPer100g: fiber,
        servingSizeG,
        servingLabel,
        category: 'usda' as const,
      };
    });
  } catch {
    return [];
  }
}

// ==================== Open Food Facts ====================

interface OFFProduct {
  code: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number;
  nutriments?: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
    fiber_100g?: number;
  };
}

function parseOFFProduct(product: OFFProduct) {
  const n = product.nutriments;
  if (!product.product_name || !n) return null;

  const calories = n['energy-kcal_100g'] ?? 0;
  const protein = n.proteins_100g ?? 0;
  const carbs = n.carbohydrates_100g ?? 0;
  const fat = n.fat_100g ?? 0;
  const fiber = n.fiber_100g ?? 0;

  // Parse serving size from string like "30g" or "1 bar (40g)"
  let servingSizeG = 100;
  if (product.serving_quantity) {
    servingSizeG = product.serving_quantity;
  } else if (product.serving_size) {
    const match = product.serving_size.match(/(\d+(?:\.\d+)?)\s*g/i);
    if (match) servingSizeG = parseFloat(match[1]);
  }

  const brand = product.brands?.split(',')[0]?.trim();
  const name = brand
    ? `${product.product_name} (${brand})`
    : product.product_name;

  return {
    id: `off-${product.code}`,
    name,
    source: 'openfoodfacts' as const,
    caloriesPer100g: calories,
    proteinPer100g: protein,
    carbsPer100g: carbs,
    fatPer100g: fat,
    fiberPer100g: fiber,
    servingSizeG,
    servingLabel: product.serving_size || `${servingSizeG}g`,
    category: 'openfoodfacts' as const,
    barcode: product.code,
  };
}

async function searchOpenFoodFacts(query: string) {
  try {
    const res = await fetch(
      `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=15&fields=code,product_name,brands,serving_size,serving_quantity,nutriments`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const products = (data.products || []) as OFFProduct[];

    return products
      .map(parseOFFProduct)
      .filter((p): p is NonNullable<typeof p> => p !== null);
  } catch {
    return [];
  }
}

// ==================== FatSecret (Platform API, free "Basic" tier) ====================
// OAuth2 client-credentials — needs FATSECRET_CLIENT_ID / FATSECRET_CLIENT_SECRET
// from a free app registered at platform.fatsecret.com. Token is cached in
// module scope for its lifetime (~24h) so we're not re-authenticating on every
// search request; this is per-server-instance, which is fine for a token
// that's cheap to refetch on a miss.
let fatSecretToken: { value: string; expiresAt: number } | null = null;

async function getFatSecretToken(): Promise<string | null> {
  if (!FATSECRET_CLIENT_ID || !FATSECRET_CLIENT_SECRET) return null;
  if (fatSecretToken && fatSecretToken.expiresAt > Date.now()) return fatSecretToken.value;

  try {
    const basicAuth = Buffer.from(`${FATSECRET_CLIENT_ID}:${FATSECRET_CLIENT_SECRET}`).toString('base64');
    const res = await fetch(FATSECRET_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=basic',
    });
    if (!res.ok) {
      console.error('[food-search] FatSecret token request failed:', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json() as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
      console.error('[food-search] FatSecret token response missing access_token:', data);
      return null;
    }
    // Refresh a bit early (60s buffer) rather than right at expiry.
    fatSecretToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000 };
    return fatSecretToken.value;
  } catch (err) {
    console.error('[food-search] FatSecret token request threw:', err);
    return null;
  }
}

interface FatSecretFood {
  food_id: string;
  food_name: string;
  brand_name?: string;
  // e.g. "Per 100g - Calories: 52kcal | Fat: 0.17g | Carbs: 13.81g | Protein: 0.26g"
  // or "Per 1 slice (28g) - Calories: 75kcal | ...". This description-string
  // format is the stable, documented shape of the v1 search endpoint (the
  // alternative, food.get per food_id for structured servings, would mean
  // one extra API call per result — not worth it against a free-tier quota).
  food_description: string;
}

// Parses food_description into per-100g macros. Returns null (skip this
// result rather than show wrong numbers) if we can't confidently determine
// the gram basis the numbers are reported against.
function parseFatSecretDescription(description: string): { caloriesPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number; servingSizeG: number; servingLabel: string } | null {
  const perMatch = description.match(/^Per\s+([^-]+?)\s*-\s*(.+)$/i);
  if (!perMatch) return null;
  const [, perLabel, macroText] = perMatch;

  const cal = macroText.match(/Calories:\s*([\d.]+)/i);
  const fat = macroText.match(/Fat:\s*([\d.]+)/i);
  const carbs = macroText.match(/Carbs:\s*([\d.]+)/i);
  const protein = macroText.match(/Protein:\s*([\d.]+)/i);
  if (!cal) return null;

  const calories = parseFloat(cal[1]);
  const fatG = fat ? parseFloat(fat[1]) : 0;
  const carbsG = carbs ? parseFloat(carbs[1]) : 0;
  const proteinG = protein ? parseFloat(protein[1]) : 0;

  const gramMatch = perLabel.match(/(\d+(?:\.\d+)?)\s*g\)?$/i);
  if (/^100\s*g/i.test(perLabel.trim())) {
    return { caloriesPer100g: calories, proteinPer100g: proteinG, carbsPer100g: carbsG, fatPer100g: fatG, servingSizeG: 100, servingLabel: '100g' };
  }
  if (gramMatch) {
    // Numbers are per that serving's gram weight, not per 100g — normalize.
    const servingG = parseFloat(gramMatch[1]);
    if (servingG <= 0) return null;
    const factor = 100 / servingG;
    return {
      caloriesPer100g: calories * factor,
      proteinPer100g: proteinG * factor,
      carbsPer100g: carbsG * factor,
      fatPer100g: fatG * factor,
      servingSizeG: servingG,
      servingLabel: perLabel.trim(),
    };
  }
  // No gram basis we can normalize against (e.g. "Per 1 cup" with no weight) —
  // rather than guess, skip it. USDA/OFF usually cover this food anyway.
  return null;
}

async function searchFatSecret(query: string) {
  const token = await getFatSecretToken();
  if (!token) return [];

  try {
    const res = await fetch(
      `${FATSECRET_SEARCH_URL}?search_expression=${encodeURIComponent(query)}&format=json&max_results=15`,
      { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 3600 } },
    );
    if (!res.ok) {
      console.error('[food-search] FatSecret search request failed:', res.status, await res.text().catch(() => ''));
      return [];
    }

    const data = await res.json();
    const rawFoods = data?.foods?.food;
    const foods: FatSecretFood[] = Array.isArray(rawFoods) ? rawFoods : rawFoods ? [rawFoods] : [];
    if (foods.length === 0) {
      console.error('[food-search] FatSecret search returned no foods for query, raw response:', JSON.stringify(data).slice(0, 500));
    }

    return foods
      .map((food) => {
        const parsed = parseFatSecretDescription(food.food_description);
        if (!parsed) {
          console.error('[food-search] FatSecret result failed description parsing:', food.food_description);
          return null;
        }
        return {
          id: `fatsecret-${food.food_id}`,
          name: food.brand_name ? `${food.food_name} (${food.brand_name})` : food.food_name,
          source: 'fatsecret' as const,
          ...parsed,
          fiberPer100g: 0,
          category: 'fatsecret' as const,
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);
  } catch {
    return [];
  }
}

// ==================== Combined Search ====================

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const source = url.searchParams.get('source'); // 'usda', 'off', 'fatsecret', or null (all)
  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  // Search all databases in parallel. FatSecret silently contributes nothing
  // if FATSECRET_CLIENT_ID/SECRET aren't set (getFatSecretToken returns null)
  // — no separate feature flag needed, it's just absent from results until
  // credentials are configured.
  const searches = [];
  if (!source || source === 'usda') searches.push(searchUSDA(query));
  if (!source || source === 'off') searches.push(searchOpenFoodFacts(query));
  if (!source || source === 'fatsecret') searches.push(searchFatSecret(query));

  const resultSets = await Promise.all(searches);

  // Interleave results from both sources for variety
  const combined = [];
  const maxLen = Math.max(...resultSets.map((r) => r.length));
  for (let i = 0; i < maxLen; i++) {
    for (const results of resultSets) {
      if (i < results.length) combined.push(results[i]);
    }
  }

  return NextResponse.json(combined);
}
