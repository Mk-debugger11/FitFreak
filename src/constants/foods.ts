import { FoodItem, FoodServing, MacroNutrients } from '../types';
import { FOOD_CATEGORIES, FoodCategory } from './nutrition';
import { isFoodBasis, isFoodCategory } from '../utils/food';
import { caloriesFromMacros } from '../features/nutrition/servingMath';

import beveragesCatalog from './foodCatalog/beverages.json';
import cookedDishesCatalog from './foodCatalog/cookedDishes.json';
import dairyCatalog from './foodCatalog/dairy.json';
import fruitsVegCatalog from './foodCatalog/fruitsVeg.json';
import grainsCatalog from './foodCatalog/grains.json';
import nutsSeedsCatalog from './foodCatalog/nutsSeeds.json';
import proteinCatalog from './foodCatalog/protein.json';
import snacksCatalog from './foodCatalog/snacks.json';

interface RawCatalogServing {
  readonly label: string;
  readonly grams: number;
}

interface RawCatalogMacros {
  readonly calories?: number;
  readonly protein: number;
  readonly carbs: number;
  readonly fat: number;
}

interface RawCatalogFood {
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly category: string;
  readonly basis: string;
  readonly macros: RawCatalogMacros;
  readonly servings?: readonly RawCatalogServing[];
  readonly defaultQuantity?: number;
  readonly notes?: string;
}

/**
 * Validation guard parsing a raw catalog food entry into a strictly typed FoodItem.
 * Returns null if required fields (name, category, basis, macros) are missing or invalid.
 * Derives calories from macros using the 4/4/9 rule if missing or 0.
 */
export const parseFoodEntry = (raw: RawCatalogFood): FoodItem | null => {
  const name = raw.name?.trim();
  if (!name || !isFoodCategory(raw.category) || !isFoodBasis(raw.basis)) {
    return null;
  }

  const { macros } = raw;
  if (!macros) return null;

  const protein =
    typeof macros.protein === 'number' && Number.isFinite(macros.protein) && macros.protein >= 0
      ? macros.protein
      : 0;
  const carbs =
    typeof macros.carbs === 'number' && Number.isFinite(macros.carbs) && macros.carbs >= 0
      ? macros.carbs
      : 0;
  const fat =
    typeof macros.fat === 'number' && Number.isFinite(macros.fat) && macros.fat >= 0
      ? macros.fat
      : 0;

  const rawCalories = macros.calories;
  const calories =
    typeof rawCalories === 'number' && Number.isFinite(rawCalories) && rawCalories > 0
      ? Math.round(rawCalories)
      : caloriesFromMacros({ protein, carbs, fat });

  const cleanedMacros: MacroNutrients = { calories, protein, carbs, fat };

  const aliases = raw.aliases
    ?.map((alias) => alias.trim())
    .filter((alias) => alias.length > 0);

  const servings: FoodServing[] | undefined = raw.servings
    ?.map((s) => ({ label: s.label.trim(), grams: s.grams }))
    .filter((s) => s.label.length > 0 && Number.isFinite(s.grams) && s.grams > 0);

  const defaultQuantity =
    typeof raw.defaultQuantity === 'number' &&
    Number.isFinite(raw.defaultQuantity) &&
    raw.defaultQuantity > 0
      ? raw.defaultQuantity
      : servings && servings.length > 0
        ? servings[0].grams
        : undefined;

  const notes = raw.notes?.trim();

  return {
    name,
    ...(aliases && aliases.length > 0 ? { aliases } : {}),
    category: raw.category,
    basis: raw.basis,
    macros: cleanedMacros,
    ...(servings && servings.length > 0 ? { servings } : {}),
    ...(defaultQuantity !== undefined ? { defaultQuantity } : {}),
    ...(notes ? { notes } : {}),
  };
};

const parseFoodEntries = (entries: readonly RawCatalogFood[]): FoodItem[] =>
  entries.flatMap((entry) => {
    const parsed = parseFoodEntry(entry);
    return parsed ? [parsed] : [];
  });

const parsedBeverages = parseFoodEntries(beveragesCatalog);
const parsedCookedDishes = parseFoodEntries(cookedDishesCatalog);
const parsedDairy = parseFoodEntries(dairyCatalog);
const parsedFruitsVeg = parseFoodEntries(fruitsVegCatalog);
const parsedGrains = parseFoodEntries(grainsCatalog);
const parsedNutsSeeds = parseFoodEntries(nutsSeedsCatalog);
const parsedProtein = parseFoodEntries(proteinCatalog);
const parsedSnacks = parseFoodEntries(snacksCatalog);

/** Built-in food catalogue, grouped by FoodCategory. */
export const FOODS_BY_CATEGORY: Record<FoodCategory, FoodItem[]> = {
  Grains: parsedGrains.filter((item) => item.category === 'Grains'),
  Protein: parsedProtein.filter((item) => item.category === 'Protein'),
  Dairy: parsedDairy.filter((item) => item.category === 'Dairy'),
  Fruit: parsedFruitsVeg.filter((item) => item.category === 'Fruit'),
  Vegetables: parsedFruitsVeg.filter((item) => item.category === 'Vegetables'),
  'Nuts & Seeds': parsedNutsSeeds.filter((item) => item.category === 'Nuts & Seeds'),
  'Cooked Dishes': parsedCookedDishes.filter((item) => item.category === 'Cooked Dishes'),
  Snacks: parsedSnacks.filter((item) => item.category === 'Snacks'),
  Beverages: parsedBeverages.filter((item) => item.category === 'Beverages'),
  Supplements: parsedProtein.filter((item) => item.category === 'Supplements'),
  Other: [],
};

/** Flat list of every built-in food across all categories. */
export const ALL_BUILTIN_FOODS: readonly FoodItem[] = FOOD_CATEGORIES.flatMap(
  (category) => FOODS_BY_CATEGORY[category],
);
