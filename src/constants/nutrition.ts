import type { ActivityLevel, FoodBasis, NutritionGoal } from '../types';

export const FOOD_CATEGORIES = [
  'Grains',
  'Protein',
  'Dairy',
  'Fruit',
  'Vegetables',
  'Nuts & Seeds',
  'Cooked Dishes',
  'Snacks',
  'Beverages',
  'Supplements',
  'Other',
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const CALORIES_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary - Little or no exercise',
  light: 'Light - 1-3 workouts a week',
  moderate: 'Moderate - 3-5 workouts a week',
  active: 'Active - 6-7 workouts a week',
  very_active: 'Very Active - Hard daily exercise or physical job',
};

export const GOAL_ADJUSTMENTS: Record<NutritionGoal, number> = {
  cut: -500,
  maintain: 0,
  bulk: 300,
};

export const GOAL_LABELS: Record<NutritionGoal, string> = {
  cut: 'Cut',
  maintain: 'Maintain',
  bulk: 'Bulk',
};

export const DEFAULT_PROTEIN_PER_KG = 1.8;
export const DEFAULT_FAT_CALORIE_SHARE = 0.25;

export const MAINTENANCE_BAND = {
  fraction: 0.05,
  minKcal: 100,
} as const;

export const BASIS_UNITS: Record<FoodBasis, { unit: string; amount: number }> = {
  per_100g: { unit: 'g', amount: 100 },
  per_100ml: { unit: 'ml', amount: 100 },
  per_piece: { unit: 'piece', amount: 1 },
};
