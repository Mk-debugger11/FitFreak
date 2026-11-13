import {
  ALL_BUILTIN_EXERCISES,
  DEFAULT_MUSCLE_EXERCISES,
  MUSCLE_GROUPS,
  MuscleGroup,
} from '../constants/exercises';
import {
  filterMuscleIds,
  GROUP_MUSCLE_FALLBACK,
  MuscleId,
  MuscleTargets,
} from '../constants/muscles';
import {
  CustomExercisesByCategory,
  DEFAULT_EQUIPMENT_TYPE,
  EQUIPMENT_TYPES,
  EquipmentType,
  ExerciseMetadata,
} from '../types';

/** Exercise entry displayed inside the category exercise picker. */
export interface CategoryExerciseItem {
  name: string;
  equipmentType: EquipmentType;
  primaryMuscles: readonly MuscleId[];
  secondaryMuscles: readonly MuscleId[];
  stabilizerMuscles?: readonly MuscleId[];
}

/** Explicit muscle overrides provided on a workout or custom exercise record. */
export interface ExplicitMuscleTargets {
  primaryMuscles?: readonly MuscleId[];
  secondaryMuscles?: readonly MuscleId[];
  stabilizerMuscles?: readonly MuscleId[];
}

const deduplicateMuscleTargets = (
  primaryMuscles?: readonly MuscleId[],
  secondaryMuscles?: readonly MuscleId[],
  stabilizerMuscles?: readonly MuscleId[],
): MuscleTargets => {
  const primary = filterMuscleIds(primaryMuscles);
  const primarySet = new Set(primary);
  const secondary = filterMuscleIds(secondaryMuscles, primarySet);
  const stabilizers = filterMuscleIds(
    stabilizerMuscles,
    new Set([...primarySet, ...secondary]),
  );
  return { primary, secondary, stabilizers };
};

const isEquipmentType = (value: unknown): value is EquipmentType =>
  typeof value === 'string' && (EQUIPMENT_TYPES as readonly string[]).includes(value);

/** Narrows an unvalidated value (API payload, persisted state) to an EquipmentType. */
export const parseEquipmentType = (value: unknown): EquipmentType | undefined =>
  isEquipmentType(value) ? value : undefined;

/** Normalizes an exercise name for case-, punctuation-, and separator-insensitive matching. */
export const normalizeExerciseName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const findInCatalog = (
  catalog: readonly ExerciseMetadata[],
  normalizedTarget: string,
): ExerciseMetadata | undefined =>
  catalog.find((exercise) => normalizeExerciseName(exercise.name) === normalizedTarget) ??
  catalog.find((exercise) =>
    exercise.aliases?.some((alias) => normalizeExerciseName(alias) === normalizedTarget),
  );

/**
 * Looks up exercise metadata by normalized name or alias, checking `extraCatalog`
 * before falling back to `ALL_BUILTIN_EXERCISES`.
 */
export const findExerciseMetadata = (
  exerciseName: string | undefined,
  extraCatalog?: readonly ExerciseMetadata[],
): ExerciseMetadata | undefined => {
  if (!exerciseName) return undefined;
  const normalizedTarget = normalizeExerciseName(exerciseName);
  if (!normalizedTarget) return undefined;

  return (
    (extraCatalog ? findInCatalog(extraCatalog, normalizedTarget) : undefined) ??
    findInCatalog(ALL_BUILTIN_EXERCISES, normalizedTarget)
  );
};

/**
 * Equipment for a workout. Older records were stored without one, so fall back
 * to looking the exercise up in the catalogue, then to the barbell default.
 */
export const resolveEquipmentType = (
  exerciseName: string | undefined,
  equipmentType?: EquipmentType,
): EquipmentType => {
  if (equipmentType) return equipmentType;
  return findExerciseMetadata(exerciseName)?.equipmentType ?? DEFAULT_EQUIPMENT_TYPE;
};

const isMuscleGroup = (value: string): value is MuscleGroup =>
  (MUSCLE_GROUPS as readonly string[]).includes(value);

// Historical workouts stored before Phase 2 may use the old plural/combined names.
const LEGACY_CATEGORY_ALIASES: Record<string, MuscleGroup> = {
  Forearms: 'Forearm',
  'Abs/Core': 'Core',
};

/**
 * Built-in exercises for a muscle group, followed by deduplicated custom exercises
 * with resolved primary, secondary, and stabilizer muscle targets.
 */
export const listExercisesForCategory = (
  category: string | null,
  customExercises: CustomExercisesByCategory,
  extraCatalog?: readonly ExerciseMetadata[],
): CategoryExerciseItem[] => {
  if (!category) return [];

  const builtIn = isMuscleGroup(category) ? DEFAULT_MUSCLE_EXERCISES[category] : [];
  const serverForCategory = extraCatalog?.filter((exercise) => exercise.muscleGroup === category) ?? [];
  const seenNames = new Set<string>();
  const items: CategoryExerciseItem[] = [];

  for (const exercise of [...builtIn, ...serverForCategory]) {
    const normalizedName = normalizeExerciseName(exercise.name);
    if (!normalizedName || seenNames.has(normalizedName)) {
      continue;
    }
    seenNames.add(normalizedName);
    for (const alias of exercise.aliases ?? []) {
      seenNames.add(normalizeExerciseName(alias));
    }
    const targets = deduplicateMuscleTargets(
      exercise.primaryMuscles,
      exercise.secondaryMuscles,
      exercise.stabilizerMuscles,
    );
    items.push({
      name: exercise.name,
      equipmentType: exercise.equipmentType,
      primaryMuscles: targets.primary,
      secondaryMuscles: targets.secondary,
      stabilizerMuscles: targets.stabilizers,
    });
  }

  for (const custom of customExercises[category] ?? []) {
    const normalizedCustomName = normalizeExerciseName(custom.name);
    if (!normalizedCustomName || seenNames.has(normalizedCustomName)) {
      continue;
    }
    seenNames.add(normalizedCustomName);

    const targets = resolveExerciseMuscles(
      custom.name,
      category,
      {
        primaryMuscles: custom.primaryMuscles,
        secondaryMuscles: custom.secondaryMuscles,
        stabilizerMuscles: custom.stabilizerMuscles,
      },
      extraCatalog,
    );

    items.push({
      name: custom.name,
      equipmentType: custom.equipmentType,
      primaryMuscles: targets?.primary ?? [],
      secondaryMuscles: targets?.secondary ?? [],
      stabilizerMuscles: targets?.stabilizers ?? [],
    });
  }

  return items;
};

/**
 * Resolves the primary, secondary, and stabilizer anatomy muscles for a logged
 * exercise, deduplicating bands in `primary > secondary > stabilizers` order.
 * Prefers validated explicit targets when present, then matches `extraCatalog`
 * or `ALL_BUILTIN_EXERCISES` by normalized name/alias, and finally falls back
 * to its muscle-group category (or `null` when unmappable).
 */
export const resolveExerciseMuscles = (
  exerciseName: string | undefined,
  category?: string,
  explicitTargets?: ExplicitMuscleTargets,
  extraCatalog?: readonly ExerciseMetadata[],
): MuscleTargets | null => {
  const explicitPrimary = filterMuscleIds(explicitTargets?.primaryMuscles);
  if (explicitPrimary.length > 0) {
    return deduplicateMuscleTargets(
      explicitPrimary,
      explicitTargets?.secondaryMuscles,
      explicitTargets?.stabilizerMuscles,
    );
  }

  const match = findExerciseMetadata(exerciseName, extraCatalog);
  if (match) {
    return deduplicateMuscleTargets(
      match.primaryMuscles,
      match.secondaryMuscles,
      match.stabilizerMuscles,
    );
  }

  if (!category) return null;
  const trimmedCategory = category.trim();
  const normalizedCategory = LEGACY_CATEGORY_ALIASES[trimmedCategory] ?? trimmedCategory;
  if (isMuscleGroup(normalizedCategory)) {
    return GROUP_MUSCLE_FALLBACK[normalizedCategory];
  }

  return null;
};
