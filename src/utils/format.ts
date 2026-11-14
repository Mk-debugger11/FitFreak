import { EquipmentType } from '../types';

/** "60kg × 8", with the wording each equipment type needs. */
export const formatSetDisplay = (weight: number, reps: number, equipment?: EquipmentType): string => {
  if (equipment === 'bodyweight') {
    return weight > 0 ? `+${weight}kg × ${reps}` : `Bodyweight × ${reps}`;
  }
  if (equipment === 'dumbbell') {
    return `${weight}kg/hand × ${reps}`;
  }
  return `${weight}kg × ${reps}`;
};

export const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Formats kilocalories rounded with thousands separator. Normalizes -0 to 0. */
export const formatCalories = (kcal: number): string => (Math.round(kcal) || 0).toLocaleString();

/** Formats grams rounded with 'g' suffix. Normalizes -0 to 0. */
export const formatGrams = (grams: number): string => `${Math.round(grams) || 0}g`;

