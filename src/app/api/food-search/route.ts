import { NextRequest, NextResponse } from 'next/server';

const USDA_API_KEY = process.env.USDA_API_KEY || 'DEMO_KEY';
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';
const OFF_BASE = 'https://world.openfoodfacts.org';

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

// ==================== Combined Search ====================

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const source = url.searchParams.get('source'); // 'usda', 'off', or null (all)
  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  // Search both databases in parallel
  const searches = [];
  if (!source || source === 'usda') searches.push(searchUSDA(query));
  if (!source || source === 'off') searches.push(searchOpenFoodFacts(query));

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
