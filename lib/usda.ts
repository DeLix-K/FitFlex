export type UsdaFoodMatch = {
  fdcId: number;
  description: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

type UsdaNutrient = { nutrientName: string; value: number; unitName: string };

// "Foundation" foods report energy under Atwater-factor names; "SR Legacy" foods
// use a plain "Energy" name with duplicate KCAL/kJ entries. Try each in order.
function getCalories(nutrients: UsdaNutrient[]): number | null {
  const byName = (name: string, unit?: string) =>
    nutrients.find((n) => n.nutrientName === name && (!unit || n.unitName === unit))?.value;

  return (
    byName('Energy (Atwater Specific Factors)') ??
    byName('Energy (Atwater General Factors)') ??
    byName('Energy', 'KCAL') ??
    null
  );
}

function getNutrient(nutrients: UsdaNutrient[], name: string): number | null {
  return nutrients.find((n) => n.nutrientName === name)?.value ?? null;
}

export async function searchUsdaFoods(query: string): Promise<UsdaFoodMatch[]> {
  const apiKey = process.env.EXPO_PUBLIC_USDA_API_KEY;
  if (!apiKey) return [];

  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}` +
    `&query=${encodeURIComponent(query)}&pageSize=5&dataType=Foundation,SR%20Legacy`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();
  const foods = (data.foods ?? []) as { fdcId: number; description: string; foodNutrients: UsdaNutrient[] }[];

  return foods.map((food) => ({
    fdcId: food.fdcId,
    description: food.description,
    calories: getCalories(food.foodNutrients),
    protein: getNutrient(food.foodNutrients, 'Protein'),
    carbs: getNutrient(food.foodNutrients, 'Carbohydrate, by difference'),
    fat: getNutrient(food.foodNutrients, 'Total lipid (fat)'),
  }));
}

export function formatUsdaMatch(match: UsdaFoodMatch): string {
  const round = (n: number | null) => (n === null ? 'n/a' : Math.round(n));
  return (
    `${match.description} (USDA FoodData Central, per 100g):\n\n` +
    `- Calories: ${round(match.calories)}\n` +
    `- Protein: ${round(match.protein)}g\n` +
    `- Carbs: ${round(match.carbs)}g\n` +
    `- Fat: ${round(match.fat)}g`
  );
}
