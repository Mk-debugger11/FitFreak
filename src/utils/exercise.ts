import { DEFAULT_MUSCLE_EXERCISES } from '../constants/exercises';
import {
  CustomExercisesByCategory,
  DEFAULT_EQUIPMENT_TYPE,
  EQUIPMENT_TYPES,
  EquipmentType,
} from '../types';

const isEquipmentType = (value: unknown): value is EquipmentType =>
  typeof value === 'string' && (EQUIPMENT_TYPES as readonly string[]).includes(value);

/** Narrows an unvalidated value (API payload, persisted state) to an EquipmentType. */
export const parseEquipmentType = (value: unknown): EquipmentType | undefined =>
  isEquipmentType(value) ? value : undefined;

/**
 * Equipment for a workout. Older records were stored without one, so fall back
 * to looking the exercise up in the catalogue, then to the barbell default.
 */
export const resolveEquipmentType = (
  exerciseName: string | undefined,
  equipmentType?: EquipmentType,
): EquipmentType => {
  if (equipmentType) return equipmentType;

  const match = Object.values(DEFAULT_MUSCLE_EXERCISES)
    .flat()
    .find((exercise) => exercise.name.toLowerCase() === exerciseName?.toLowerCase());

  return match ? match.equipmentType : DEFAULT_EQUIPMENT_TYPE;
};

/** Built-in exercises for a muscle group, followed by the user's own. */
export const listExercisesForCategory = (
  category: string | null,
  customExercises: CustomExercisesByCategory,
): { name: string; equipmentType: EquipmentType }[] => {
  if (!category) return [];
  return [...(DEFAULT_MUSCLE_EXERCISES[category] ?? []), ...(customExercises[category] ?? [])];
};
