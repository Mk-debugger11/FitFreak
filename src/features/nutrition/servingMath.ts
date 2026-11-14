import type { FoodItem, MacroNutrients } from '../../types';
import { BASIS_UNITS } from '../../constants/nutrition';

/**
 * Returns an empty MacroNutrients object with zeroed values.
 */
export function emptyMacros(): MacroNutrients {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };
}

/**
 * Derives calories from macros using the 4/4/9 rule.
 * Useful for food items that omit explicit calories or for sanity checks.
 */
export function caloriesFromMacros(
  macros: Omit<MacroNutrients, 'calories'> | MacroNutrients,
): number {
  return Math.round(
    (macros.protein || 0) * 4 + (macros.carbs || 0) * 4 + (macros.fat || 0) * 9,
  );
}

/**
 * Scales a food's macros by a given quantity in the food's basis units (g, ml, or piece).
 * Preserves full floating-point precision (rounding occurs at display time).
 */
export function scaleMacros(
  food: Pick<FoodItem, 'basis' | 'macros'>,
  quantity: number,
): MacroNutrients {
  const basisUnit = BASIS_UNITS[food.basis];
  const basisAmount = basisUnit ? basisUnit.amount : 100;
  const scale = basisAmount > 0 ? quantity / basisAmount : 0;

  return {
    calories: food.macros.calories * scale,
    protein: food.macros.protein * scale,
    carbs: food.macros.carbs * scale,
    fat: food.macros.fat * scale,
  };
}

/**
 * Accumulates two MacroNutrients objects together.
 */
export function addMacros(a: MacroNutrients, b: MacroNutrients): MacroNutrients {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

/**
 * Computes each macronutrient's share of total calories accounted for by macros (4/4/9).
 * Returns normalized shares summing to 1.0 (or 0/0/0 if all macros are zero).
 * Drives the proportional macro bar.
 */
export function macroCalorieShares(macros: MacroNutrients): {
  protein: number;
  carbs: number;
  fat: number;
} {
  const calP = Math.max(0, (macros.protein || 0) * 4);
  const calC = Math.max(0, (macros.carbs || 0) * 4);
  const calF = Math.max(0, (macros.fat || 0) * 9);
  const sum = calP + calC + calF;

  if (sum <= 0) {
    return { protein: 0, carbs: 0, fat: 0 };
  }

  return {
    protein: calP / sum,
    carbs: calC / sum,
    fat: calF / sum,
  };
}

