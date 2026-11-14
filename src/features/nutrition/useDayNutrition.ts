import { useMemo } from 'react';
import { useNutritionStore } from '../../store/nutritionStore';
import { computeDayNutrition, DayNutrition } from './nutritionTotals';

/**
 * Hook providing computed nutrition metrics for a specific calendar date (YYYY-MM-DD).
 * Memoized against the store's logged foods and the given dateKey.
 */
export function useDayNutrition(dateKey: string): DayNutrition {
  const loggedFoods = useNutritionStore((state) => state.loggedFoods);

  return useMemo(
    () => computeDayNutrition(loggedFoods, dateKey),
    [loggedFoods, dateKey],
  );
}

