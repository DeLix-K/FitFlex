// Open Food Facts: a free, no-API-key-required public database of real
// packaged-product nutrition facts, keyed by barcode (UPC/EAN). Chosen
// specifically because USDA FoodData Central has no barcode lookup at all
// -- it's a raw-ingredient/generic-foods database, not a barcode index.
// Values here are exactly what's on the product's real nutrition label
// (per 100g, the universal unit Open Food Facts normalizes to), never
// estimated or invented.
export type BarcodeMatch = {
  barcode: string;
  name: string;
  brand: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  iron: number | null;
  servingSize: string | null;
  imageUrl: string | null;
};

export async function lookupBarcode(barcode: string): Promise<BarcodeMatch | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`);
  if (!res.ok) return null;

  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;

  const product = data.product as {
    product_name?: string;
    brands?: string;
    serving_size?: string;
    image_front_url?: string;
    image_url?: string;
    nutriments?: Record<string, number>;
  };
  const n = product.nutriments ?? {};

  if (!product.product_name) return null;

  return {
    barcode,
    name: product.product_name,
    brand: product.brands ?? null,
    calories: typeof n['energy-kcal_100g'] === 'number' ? n['energy-kcal_100g'] : null,
    protein: typeof n['proteins_100g'] === 'number' ? n['proteins_100g'] : null,
    carbs: typeof n['carbohydrates_100g'] === 'number' ? n['carbohydrates_100g'] : null,
    fat: typeof n['fat_100g'] === 'number' ? n['fat_100g'] : null,
    fiber: typeof n['fiber_100g'] === 'number' ? n['fiber_100g'] : null,
    iron: typeof n['iron_100g'] === 'number' ? n['iron_100g'] * 1000 : null, // OFF reports iron in g/100g; convert to mg
    servingSize: product.serving_size ?? null,
    imageUrl: product.image_front_url ?? product.image_url ?? null,
  };
}
