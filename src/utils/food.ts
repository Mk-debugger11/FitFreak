import { FOOD_CATEGORIES, FoodCategory } from '../constants/nutrition';
import { FOOD_BASES, FoodBasis, FoodItem } from '../types';

/**
 * Normalizes a food name or alias for case-, punctuation-, and separator-insensitive matching.
 * Converts to lowercase, strips common apostrophes, collapses any sequence of non-alphanumeric
 * characters to a single space, and trims.
 */
export const normalizeFoodName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const FOOD_CATEGORY_SET: ReadonlySet<string> = new Set(FOOD_CATEGORIES);
const FOOD_BASIS_SET: ReadonlySet<string> = new Set(FOOD_BASES);

export const isFoodCategory = (value: unknown): value is FoodCategory =>
  typeof value === 'string' && FOOD_CATEGORY_SET.has(value);

export const isFoodBasis = (value: unknown): value is FoodBasis =>
  typeof value === 'string' && FOOD_BASIS_SET.has(value);

/**
 * Looks up a food item by normalized name or alias from a list of foods.
 */
export const findFoodInCatalog = (
  catalog: readonly FoodItem[],
  query: string,
): FoodItem | undefined => {
  const normalizedQuery = normalizeFoodName(query);
  if (!normalizedQuery) return undefined;
  return (
    catalog.find((item) => normalizeFoodName(item.name) === normalizedQuery) ??
    catalog.find((item) =>
      item.aliases?.some((alias) => normalizeFoodName(alias) === normalizedQuery),
    )
  );
};
