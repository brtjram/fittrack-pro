import { NextRequest, NextResponse } from 'next/server';

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const barcode = url.searchParams.get('code');

  if (!barcode || !/^\d{8,14}$/.test(barcode)) {
    return NextResponse.json({ error: 'Invalid barcode' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${OFF_BASE}/product/${barcode}?fields=code,product_name,brands,serving_size,serving_quantity,nutriments,image_front_small_url`,
      { next: { revalidate: 86400 } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const data = await res.json();
    if (data.status !== 1 || !data.product?.product_name) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const p = data.product;
    const n = p.nutriments || {};

    const calories = n['energy-kcal_100g'] ?? 0;
    const protein = n.proteins_100g ?? 0;
    const carbs = n.carbohydrates_100g ?? 0;
    const fat = n.fat_100g ?? 0;
    const fiber = n.fiber_100g ?? 0;

    let servingSizeG = 100;
    if (p.serving_quantity) {
      servingSizeG = p.serving_quantity;
    } else if (p.serving_size) {
      const match = p.serving_size.match(/(\d+(?:\.\d+)?)\s*g/i);
      if (match) servingSizeG = parseFloat(match[1]);
    }

    const brand = p.brands?.split(',')[0]?.trim();
    const name = brand ? `${p.product_name} (${brand})` : p.product_name;

    return NextResponse.json({
      id: `off-${p.code}`,
      name,
      caloriesPer100g: calories,
      proteinPer100g: protein,
      carbsPer100g: carbs,
      fatPer100g: fat,
      fiberPer100g: fiber,
      servingSizeG,
      servingLabel: p.serving_size || `${servingSizeG}g`,
      category: 'openfoodfacts',
      barcode: p.code,
      imageUrl: p.image_front_small_url,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to look up barcode' }, { status: 500 });
  }
}
