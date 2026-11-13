import { MUSCLE_GROUPS, MuscleGroup } from '../constants/exercises';
import { MUSCLE_ID_SET } from '../constants/muscles';
import { EQUIPMENT_TYPES } from '../types';
import { normalizeExerciseName } from './exercise';

/** Muscle tier fields present on every built-in exercise catalog entry. */
export type CatalogMuscleBand = 'primaryMuscles' | 'secondaryMuscles' | 'stabilizerMuscles';

/** Single validation error discovered while inspecting a catalog entry. */
export interface CatalogValidationError {
  index: number;
  exerciseName?: string;
  field: string;
  message: string;
}

/** Optional overrides controlling catalog validation rules. */
export interface CatalogValidationOptions {
  allowedMuscleGroups?: readonly string[];
  allowedEquipmentTypes?: readonly string[];
  allowedMuscleIds?: readonly string[];
  requireStabilizerMuscles?: boolean;
  requireNotes?: boolean;
}

/** Result returned by `validateExerciseCatalog`. */
export interface CatalogValidationResult {
  valid: boolean;
  exerciseCount: number;
  errors: CatalogValidationError[];
}

interface TermOwner {
  index: number;
  name: string;
  kind: 'name' | 'alias';
}

interface ValidationContext {
  validMuscleGroups: ReadonlySet<string>;
  validEquipmentTypes: ReadonlySet<string>;
  validMuscleIds: ReadonlySet<string>;
  requireStabilizerMuscles: boolean;
  requireNotes: boolean;
  ownerByTerm: Map<string, TermOwner>;
  errors: CatalogValidationError[];
}

/** Built-in catalog muscle groups (all `MUSCLE_GROUPS` excluding aggregate target categories). */
export const CATALOG_MUSCLE_GROUPS: readonly MuscleGroup[] = MUSCLE_GROUPS.filter(
  (group): group is Exclude<MuscleGroup, 'Cardio' | 'Full Body'> =>
    group !== 'Cardio' && group !== 'Full Body',
);

const DEFAULT_MUSCLE_GROUP_SET: ReadonlySet<string> = new Set(CATALOG_MUSCLE_GROUPS);
const DEFAULT_EQUIPMENT_TYPE_SET: ReadonlySet<string> = new Set(EQUIPMENT_TYPES);

const BAND_PAIRS: readonly (readonly [CatalogMuscleBand, CatalogMuscleBand])[] = [
  ['primaryMuscles', 'secondaryMuscles'],
  ['primaryMuscles', 'stabilizerMuscles'],
  ['secondaryMuscles', 'stabilizerMuscles'],
];

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const pushError = (
  errors: CatalogValidationError[],
  index: number,
  field: string,
  message: string,
  exerciseName?: string,
): void => {
  errors.push({
    index,
    ...(exerciseName ? { exerciseName } : {}),
    field,
    message,
  });
};

const validateNameAndAliases = (
  entry: Record<string, unknown>,
  index: number,
  ctx: ValidationContext,
): string | undefined => {
  const rawName = entry.name;
  if (typeof rawName !== 'string' || rawName.trim().length === 0) {
    pushError(ctx.errors, index, 'name', 'Exercise name must be a non-empty string.');
    return undefined;
  }

  const trimmedName = rawName.trim();
  const normalizedName = normalizeExerciseName(trimmedName);
  if (!normalizedName) {
    pushError(
      ctx.errors,
      index,
      'name',
      `Exercise name "${trimmedName}" is empty after normalization.`,
      trimmedName,
    );
    return trimmedName;
  }

  const existingOwner = ctx.ownerByTerm.get(normalizedName);
  if (existingOwner && existingOwner.index !== index) {
    pushError(
      ctx.errors,
      index,
      'name',
      `Normalized name "${normalizedName}" collides with ${existingOwner.kind} of "${existingOwner.name}" (index ${existingOwner.index}).`,
      trimmedName,
    );
  } else {
    ctx.ownerByTerm.set(normalizedName, { index, name: trimmedName, kind: 'name' });
  }

  if (entry.aliases === undefined) {
    return trimmedName;
  }

  if (!Array.isArray(entry.aliases)) {
    pushError(ctx.errors, index, 'aliases', 'Aliases must be an array of strings.', trimmedName);
    return trimmedName;
  }

  const seenRawAliases = new Set<string>();
  for (const rawAlias of entry.aliases) {
    if (typeof rawAlias !== 'string' || rawAlias.trim().length === 0) {
      pushError(
        ctx.errors,
        index,
        'aliases',
        'Every alias must be a non-empty string.',
        trimmedName,
      );
      continue;
    }

    const trimmedAlias = rawAlias.trim();
    if (trimmedAlias === trimmedName) {
      pushError(
        ctx.errors,
        index,
        'aliases',
        `Alias "${trimmedAlias}" duplicates the exercise name verbatim.`,
        trimmedName,
      );
      continue;
    }

    if (seenRawAliases.has(trimmedAlias)) {
      pushError(
        ctx.errors,
        index,
        'aliases',
        `Duplicate alias "${trimmedAlias}" within exercise.`,
        trimmedName,
      );
      continue;
    }
    seenRawAliases.add(trimmedAlias);

    const normalizedAlias = normalizeExerciseName(trimmedAlias);
    if (!normalizedAlias) {
      pushError(
        ctx.errors,
        index,
        'aliases',
        `Alias "${trimmedAlias}" is empty after normalization.`,
        trimmedName,
      );
      continue;
    }

    const aliasOwner = ctx.ownerByTerm.get(normalizedAlias);
    if (aliasOwner && aliasOwner.index !== index) {
      pushError(
        ctx.errors,
        index,
        'aliases',
        `Normalized alias "${normalizedAlias}" ("${trimmedAlias}") collides with ${aliasOwner.kind} of "${aliasOwner.name}" (index ${aliasOwner.index}).`,
        trimmedName,
      );
    } else if (!aliasOwner) {
      ctx.ownerByTerm.set(normalizedAlias, { index, name: trimmedName, kind: 'alias' });
    }
  }

  return trimmedName;
};

const validateMuscleBand = (
  rawBand: unknown,
  band: CatalogMuscleBand,
  index: number,
  exerciseName: string | undefined,
  ctx: ValidationContext,
): string[] => {
  if (!Array.isArray(rawBand)) {
    pushError(ctx.errors, index, band, `${band} must be an array of valid muscle IDs.`, exerciseName);
    return [];
  }

  const seen = new Set<string>();
  const validIds: string[] = [];

  for (const rawId of rawBand) {
    if (typeof rawId !== 'string' || !ctx.validMuscleIds.has(rawId)) {
      pushError(
        ctx.errors,
        index,
        band,
        `Invalid muscle ID "${String(rawId)}" in ${band}.`,
        exerciseName,
      );
      continue;
    }
    if (seen.has(rawId)) {
      pushError(
        ctx.errors,
        index,
        band,
        `Duplicate muscle ID "${rawId}" in ${band}.`,
        exerciseName,
      );
      continue;
    }
    seen.add(rawId);
    validIds.push(rawId);
  }

  return validIds;
};

const validateSingleEntry = (
  rawEntry: unknown,
  index: number,
  ctx: ValidationContext,
): void => {
  if (!isPlainRecord(rawEntry)) {
    pushError(ctx.errors, index, 'entry', 'Catalog entry must be a plain object.');
    return;
  }

  const exerciseName = validateNameAndAliases(rawEntry, index, ctx);

  if (typeof rawEntry.muscleGroup !== 'string' || !ctx.validMuscleGroups.has(rawEntry.muscleGroup)) {
    pushError(
      ctx.errors,
      index,
      'muscleGroup',
      `Invalid muscleGroup "${String(rawEntry.muscleGroup)}".`,
      exerciseName,
    );
  }

  if (
    typeof rawEntry.equipmentType !== 'string' ||
    !ctx.validEquipmentTypes.has(rawEntry.equipmentType)
  ) {
    pushError(
      ctx.errors,
      index,
      'equipmentType',
      `Invalid equipmentType "${String(rawEntry.equipmentType)}".`,
      exerciseName,
    );
  }

  if (ctx.requireNotes) {
    if (typeof rawEntry.notes !== 'string' || rawEntry.notes.trim().length === 0) {
      pushError(
        ctx.errors,
        index,
        'notes',
        'notes must be a non-empty string.',
        exerciseName,
      );
    }
  } else if (
    rawEntry.notes !== undefined &&
    (typeof rawEntry.notes !== 'string' || rawEntry.notes.trim().length === 0)
  ) {
    pushError(
      ctx.errors,
      index,
      'notes',
      'notes must be a non-empty string when provided.',
      exerciseName,
    );
  }

  const primaryIds = validateMuscleBand(
    rawEntry.primaryMuscles,
    'primaryMuscles',
    index,
    exerciseName,
    ctx,
  );
  if (Array.isArray(rawEntry.primaryMuscles) && rawEntry.primaryMuscles.length === 0) {
    pushError(
      ctx.errors,
      index,
      'primaryMuscles',
      'primaryMuscles must contain at least one muscle ID.',
      exerciseName,
    );
  }

  const secondaryIds = validateMuscleBand(
    rawEntry.secondaryMuscles,
    'secondaryMuscles',
    index,
    exerciseName,
    ctx,
  );

  const stabilizerIds =
    !ctx.requireStabilizerMuscles && rawEntry.stabilizerMuscles === undefined
      ? []
      : validateMuscleBand(
          rawEntry.stabilizerMuscles,
          'stabilizerMuscles',
          index,
          exerciseName,
          ctx,
        );

  const bandSets: Record<CatalogMuscleBand, ReadonlySet<string>> = {
    primaryMuscles: new Set(primaryIds),
    secondaryMuscles: new Set(secondaryIds),
    stabilizerMuscles: new Set(stabilizerIds),
  };

  for (const [firstBand, secondBand] of BAND_PAIRS) {
    const secondSet = bandSets[secondBand];
    for (const id of bandSets[firstBand]) {
      if (secondSet.has(id)) {
        pushError(
          ctx.errors,
          index,
          `${firstBand}/${secondBand}`,
          `Muscle ID "${id}" appears in both ${firstBand} and ${secondBand}.`,
          exerciseName,
        );
      }
    }
  }
};

/**
 * Validates an exercise catalog array against name/alias uniqueness, enum
 * memberships, valid `MuscleId` bands, non-empty primary muscles, and strict
 * disjointness across primary, secondary, and stabilizer muscle arrays.
 */
export const validateExerciseCatalog = (
  entries: readonly unknown[],
  options?: CatalogValidationOptions,
): CatalogValidationResult => {
  if (!Array.isArray(entries)) {
    return {
      valid: false,
      exerciseCount: 0,
      errors: [{ index: -1, field: 'catalog', message: 'Catalog must be an array.' }],
    };
  }

  const ctx: ValidationContext = {
    validMuscleGroups: options?.allowedMuscleGroups
      ? new Set(options.allowedMuscleGroups)
      : DEFAULT_MUSCLE_GROUP_SET,
    validEquipmentTypes: options?.allowedEquipmentTypes
      ? new Set(options.allowedEquipmentTypes)
      : DEFAULT_EQUIPMENT_TYPE_SET,
    validMuscleIds: options?.allowedMuscleIds ? new Set(options.allowedMuscleIds) : MUSCLE_ID_SET,
    requireStabilizerMuscles: options?.requireStabilizerMuscles ?? true,
    requireNotes: options?.requireNotes ?? false,
    ownerByTerm: new Map<string, TermOwner>(),
    errors: [],
  };

  for (let index = 0; index < entries.length; index += 1) {
    validateSingleEntry(entries[index], index, ctx);
  }

  return {
    valid: ctx.errors.length === 0,
    exerciseCount: entries.length,
    errors: ctx.errors,
  };
};
