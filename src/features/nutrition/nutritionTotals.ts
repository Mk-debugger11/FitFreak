import type { LoggedFood, MacroNutrients, MealType } from '../../types';
import { MEAL_TYPES } from '../../types';
import { addMacros, emptyMacros } from './servingMath';

export interface MealNutrition {
  entries: LoggedFood[];
  totals: MacroNutrients;
}

export interface DayNutrition {
  byMeal: Record<MealType, MealNutrition>;
  totals: MacroNutrients;
  entryCount: number;
}

export interface RemainingCalories {
  kcal: number;
  isOver: boolean;
}

/**
 * Aggregates a list of logged foods for a specific calendar day (YYYY-MM-DD).
 * - Filters entries where dateString === dateKey.
 * - Buckets into each meal type with all MEAL_TYPES guaranteed present (empty arrays / zero totals).
 * - Orders each meal's entries chronologically by loggedAt ascending.
 * - Computes total macros per meal and for the full day.
 */
export function computeDayNutrition(
  entries: LoggedFood[],
  dateKey: string,
): DayNutrition {
  const byMeal = MEAL_TYPES.reduce((acc, mealType) => {
    acc[mealType] = {
      entries: [],
      totals: emptyMacros(),
    };
    return acc;
  }, {} as Record<MealType, MealNutrition>);

  let dayTotals = emptyMacros();
  let entryCount = 0;

  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      byMeal,
      totals: dayTotals,
      entryCount: 0,
    };
  }

  for (const entry of entries) {
    if (entry && entry.dateString === dateKey && entry.mealType in byMeal) {
      byMeal[entry.mealType].entries.push(entry);
      byMeal[entry.mealType].totals = addMacros(
        byMeal[entry.mealType].totals,
        entry.macros,
      );
      dayTotals = addMacros(dayTotals, entry.macros);
      entryCount++;
    }
  }

  // Sort entries within each meal chronologically ascending
  for (const mealType of MEAL_TYPES) {
    byMeal[mealType].entries.sort((a, b) => {
      const timeA = new Date(a.loggedAt).getTime();
      const timeB = new Date(b.loggedAt).getTime();
      return timeA - timeB;
    });
  }

  return {
    byMeal,
    totals: dayTotals,
    entryCount,
  };
}

/**
 * Computes remaining calories against target.
 * diff = target - Math.round(totals.calories).
 * If diff >= 0 -> { kcal: diff, isOver: false }, else -> { kcal: Math.abs(diff), isOver: true }.
 */
export function computeRemaining(
  totals: MacroNutrients,
  target: number,
): RemainingCalories {
  const roundedTarget = Math.round(target);
  const roundedCalories = Math.round(totals.calories);
  const diff = roundedTarget - roundedCalories;

  if (diff >= 0) {
    return {
      kcal: diff,
      isOver: false,
    };
  }

  return {
    kcal: Math.abs(diff),
    isOver: true,
  };
}

