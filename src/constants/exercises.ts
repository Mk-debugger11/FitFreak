import { EQUIPMENT_TYPES, EquipmentType, ExerciseMetadata } from '../types';
import { filterMuscleIds, MuscleId } from './muscles';
import backCatalog from './exerciseCatalog/back.json';
import bicepsCatalog from './exerciseCatalog/biceps.json';
import chestCatalog from './exerciseCatalog/chest.json';
import coreNeckCatalog from './exerciseCatalog/coreNeck.json';
import forearmCatalog from './exerciseCatalog/forearm.json';
import legsCatalog from './exerciseCatalog/legs.json';
import shouldersCatalog from './exerciseCatalog/shoulders.json';
import tricepsCatalog from './exerciseCatalog/triceps.json';

/** Muscle groups the user can target on a given day. */
export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearm',
  'Abs',
  'Core',
  'Neck',
  'Cardio',
  'Full Body',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

interface RawCatalogExercise {
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly muscleGroup: string;
  readonly equipmentType: string;
  readonly primaryMuscles: readonly string[];
  readonly secondaryMuscles: readonly string[];
  readonly stabilizerMuscles?: readonly string[];
  readonly notes?: string;
}

const MUSCLE_GROUP_SET: ReadonlySet<string> = new Set(MUSCLE_GROUPS);
const EQUIPMENT_TYPE_SET: ReadonlySet<string> = new Set(EQUIPMENT_TYPES);

const isMuscleGroup = (value: string): value is MuscleGroup => MUSCLE_GROUP_SET.has(value);
const isEquipmentType = (value: string): value is EquipmentType => EQUIPMENT_TYPE_SET.has(value);

const parseCatalogEntry = (raw: RawCatalogExercise): ExerciseMetadata | null => {
  const name = raw.name.trim();
  if (!name || !isMuscleGroup(raw.muscleGroup) || !isEquipmentType(raw.equipmentType)) {
    return null;
  }

  const primaryMuscles: MuscleId[] = filterMuscleIds(raw.primaryMuscles);
  const secondaryMuscles: MuscleId[] = filterMuscleIds(
    raw.secondaryMuscles,
    new Set(primaryMuscles),
  );
  const stabilizerMuscles: MuscleId[] = filterMuscleIds(
    raw.stabilizerMuscles,
    new Set([...primaryMuscles, ...secondaryMuscles]),
  );
  const aliases = raw.aliases?.map((alias) => alias.trim()).filter(Boolean);
  const notes = raw.notes?.trim();

  return {
    name,
    ...(aliases && aliases.length > 0 ? { aliases } : {}),
    muscleGroup: raw.muscleGroup,
    equipmentType: raw.equipmentType,
    primaryMuscles,
    secondaryMuscles,
    stabilizerMuscles,
    ...(notes ? { notes } : {}),
  };
};

const parseCatalogEntries = (entries: readonly RawCatalogExercise[]): ExerciseMetadata[] =>
  entries.flatMap((entry) => {
    const parsed = parseCatalogEntry(entry);
    return parsed ? [parsed] : [];
  });

const coreNeckExercises = parseCatalogEntries(coreNeckCatalog);

/** Built-in exercise catalogue, keyed by muscle group. */
export const DEFAULT_MUSCLE_EXERCISES: Record<MuscleGroup, ExerciseMetadata[]> = {
  Chest: parseCatalogEntries(chestCatalog),
  Back: parseCatalogEntries(backCatalog),
  Legs: parseCatalogEntries(legsCatalog),
  Shoulders: parseCatalogEntries(shouldersCatalog),
  Biceps: parseCatalogEntries(bicepsCatalog),
  Triceps: parseCatalogEntries(tricepsCatalog),
  Forearm: parseCatalogEntries(forearmCatalog),
  Abs: coreNeckExercises.filter((exercise) => exercise.muscleGroup === 'Abs'),
  Core: coreNeckExercises.filter((exercise) => exercise.muscleGroup === 'Core'),
  Neck: coreNeckExercises.filter((exercise) => exercise.muscleGroup === 'Neck'),
  Cardio: [],
  'Full Body': [],
};

/** Flat list of every built-in exercise across all muscle groups. */
export const ALL_BUILTIN_EXERCISES: readonly ExerciseMetadata[] = MUSCLE_GROUPS.flatMap(
  (group) => DEFAULT_MUSCLE_EXERCISES[group],
);
