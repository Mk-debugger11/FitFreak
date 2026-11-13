/**
 * The single place that talks to the backend.
 *
 * Reads go through `api.*` and are parsed into domain models here, so the rest
 * of the app never sees an ISO string or an unvalidated payload. Writes are
 * queued by `store/syncStore.ts` (offline-first), which is why the endpoint
 * URLs are exported separately.
 */
import { MUSCLE_GROUPS, MuscleGroup } from '../constants/exercises';
import { filterMuscleIds, MuscleId } from '../constants/muscles';
import {
  ActiveWorkout,
  CompletedWorkout,
  CustomExercise,
  CustomExercisesByCategory,
  DEFAULT_EQUIPMENT_TYPE,
  ExerciseMetadata,
  TargetMuscleGroups,
  WorkoutSet,
} from '../types';
import { parseEquipmentType } from '../utils/exercise';

const DEFAULT_API_URL = 'https://mukulkr.space/api';
const API_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

/** Absolute URLs, also used as the identity of a queued offline mutation. */
export const endpoints = {
  workouts: `${API_URL}/workouts`,
  workout: (id: string) => `${API_URL}/workouts/${id}`,
  workoutName: (id: string) => `${API_URL}/workouts/${id}/name`,
  targetMuscles: `${API_URL}/target-muscles`,
  customExercises: `${API_URL}/custom-exercises`,
  exercises: `${API_URL}/exercises`,
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

// --- Wire formats -----------------------------------------------------------

type Json = Record<string, any>;

interface TargetMuscleDto {
  dateString: string;
  muscles: string[];
}

interface CustomExerciseDto {
  category: string;
  /** Older records stored plain names instead of objects. */
  exercises: (
    | string
    | {
        name: string;
        equipmentType?: string;
        primaryMuscles?: unknown[];
        secondaryMuscles?: unknown[];
        stabilizerMuscles?: unknown[];
      }
  )[];
}

const MUSCLE_GROUP_SET: ReadonlySet<string> = new Set(MUSCLE_GROUPS);

const isMuscleGroup = (value: unknown): value is MuscleGroup =>
  typeof value === 'string' && MUSCLE_GROUP_SET.has(value);

// --- Parsers ----------------------------------------------------------------

/**
 * Validates and deduplicates persisted or API-supplied explicit muscle targets.
 * Only preserves overrides when at least one valid primary muscle is present.
 */
export const parseExplicitTargets = (dto: {
  primaryMuscles?: unknown;
  secondaryMuscles?: unknown;
  stabilizerMuscles?: unknown;
}): {
  primaryMuscles?: readonly MuscleId[];
  secondaryMuscles?: readonly MuscleId[];
  stabilizerMuscles?: readonly MuscleId[];
} => {
  const primary = Array.isArray(dto.primaryMuscles) ? filterMuscleIds(dto.primaryMuscles) : [];
  if (primary.length === 0) return {};

  const secondary = Array.isArray(dto.secondaryMuscles)
    ? filterMuscleIds(dto.secondaryMuscles, new Set(primary))
    : [];
  return {
    primaryMuscles: primary,
    secondaryMuscles: secondary,
    ...(Array.isArray(dto.stabilizerMuscles)
      ? {
          stabilizerMuscles: filterMuscleIds(
            dto.stabilizerMuscles,
            new Set([...primary, ...secondary]),
          ),
        }
      : {}),
  };
};

const parseRir = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(10, Math.max(0, value));
};

const parseSet = (dto: Json): WorkoutSet => {
  const rir = parseRir(dto.rir);
  return {
    id: String(dto.id),
    exerciseId: String(dto.exerciseId),
    weight: Number(dto.weight) || 0,
    reps: Number(dto.reps) || 0,
    completed: Boolean(dto.completed),
    ...(typeof dto.isWarmup === 'boolean' ? { isWarmup: dto.isWarmup } : {}),
    ...(rir !== undefined ? { rir } : {}),
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
};

const parseActiveWorkout = (dto: Json): ActiveWorkout => ({
  id: String(dto.id),
  name: dto.name ?? '',
  templateId: dto.templateId ?? undefined,
  category: dto.category ?? undefined,
  equipmentType: parseEquipmentType(dto.equipmentType),
  ...parseExplicitTargets(dto),
  startTime: new Date(dto.startTime),
  endTime: dto.endTime ? new Date(dto.endTime) : undefined,
  sets: Array.isArray(dto.sets) ? dto.sets.map(parseSet) : [],
  createdAt: new Date(dto.createdAt),
  updatedAt: new Date(dto.updatedAt),
});

/** Parses a completed workout DTO from the API or persisted storage into a domain model. */
export const parseCompletedWorkout = (dto: Json): CompletedWorkout => ({
  id: String(dto.id),
  name: dto.name ?? '',
  category: dto.category ?? undefined,
  equipmentType: parseEquipmentType(dto.equipmentType),
  ...parseExplicitTargets(dto),
  startTime: new Date(dto.startTime),
  endTime: new Date(dto.endTime),
  totalVolume: Number(dto.totalVolume) || 0,
  totalSets: Number(dto.totalSets) || 0,
  workoutData: parseActiveWorkout(dto.workoutData ?? {}),
  createdAt: new Date(dto.createdAt),
  updatedAt: new Date(dto.updatedAt),
});

/** Parses a legacy string or structured custom exercise DTO into a domain model. */
export const parseCustomExercise = (dto: unknown): CustomExercise => {
  if (typeof dto === 'string') {
    return { name: dto, equipmentType: DEFAULT_EQUIPMENT_TYPE };
  }
  const record = (dto && typeof dto === 'object' ? dto : {}) as Json;
  return {
    name: typeof record.name === 'string' ? record.name : '',
    equipmentType: parseEquipmentType(record.equipmentType) ?? DEFAULT_EQUIPMENT_TYPE,
    ...parseExplicitTargets(record),
  };
};

/** Parses and validates an exercise metadata entry from the catalog API or cache. */
export const parseExerciseMetadata = (dto: unknown): ExerciseMetadata | null => {
  if (!dto || typeof dto !== 'object') return null;
  const record = dto as Json;
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const equipmentType = parseEquipmentType(record.equipmentType);
  if (!name || !isMuscleGroup(record.muscleGroup) || !equipmentType) {
    return null;
  }

  const primaryMuscles = filterMuscleIds(
    Array.isArray(record.primaryMuscles) ? record.primaryMuscles : undefined,
  );
  const secondaryMuscles = filterMuscleIds(
    Array.isArray(record.secondaryMuscles) ? record.secondaryMuscles : undefined,
    new Set(primaryMuscles),
  );
  const stabilizerMuscles = filterMuscleIds(
    Array.isArray(record.stabilizerMuscles) ? record.stabilizerMuscles : undefined,
    new Set([...primaryMuscles, ...secondaryMuscles]),
  );
  const aliases = Array.isArray(record.aliases)
    ? record.aliases.filter((alias): alias is string => typeof alias === 'string' && alias.trim().length > 0)
    : undefined;
  const notes = typeof record.notes === 'string' && record.notes.trim() ? record.notes.trim() : undefined;

  return {
    name,
    muscleGroup: record.muscleGroup,
    equipmentType,
    primaryMuscles,
    secondaryMuscles,
    stabilizerMuscles,
    ...(aliases && aliases.length > 0 ? { aliases } : {}),
    ...(notes ? { notes } : {}),
  };
};

// --- Reads ------------------------------------------------------------------

export const api = {
  async getWorkouts(range: { startDate?: Date; endDate?: Date } = {}): Promise<CompletedWorkout[]> {
    const params = new URLSearchParams();
    if (range.startDate) params.append('startDate', range.startDate.toISOString());
    if (range.endDate) params.append('endDate', range.endDate.toISOString());

    const query = params.toString();
    const dtos = await getJson<Json[]>(query ? `${endpoints.workouts}?${query}` : endpoints.workouts);
    return dtos.map(parseCompletedWorkout);
  },

  async getTargetMuscles(): Promise<TargetMuscleGroups> {
    const dtos = await getJson<TargetMuscleDto[]>(endpoints.targetMuscles);
    if (!Array.isArray(dtos)) return {};
    return Object.fromEntries(
      dtos
        .filter((dto) => typeof dto?.dateString === 'string' && dto.dateString.length > 0)
        .map((dto) => [dto.dateString, Array.isArray(dto.muscles) ? dto.muscles : []]),
    );
  },

  async getCustomExercises(): Promise<CustomExercisesByCategory> {
    const dtos = await getJson<CustomExerciseDto[]>(endpoints.customExercises);
    return Object.fromEntries(
      dtos.map((dto) => [
        dto.category,
        (Array.isArray(dto.exercises) ? dto.exercises : [])
          .map(parseCustomExercise)
          .filter((exercise) => exercise.name.length > 0),
      ]),
    );
  },

  /** Returns null when the remote server does not yet expose `/api/exercises` (404). */
  async getExercises(): Promise<ExerciseMetadata[] | null> {
    const response = await fetch(endpoints.exercises);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`GET ${endpoints.exercises} failed with status ${response.status}`);
    }
    const dtos = (await response.json()) as unknown[];
    if (!Array.isArray(dtos)) return [];
    return dtos
      .map(parseExerciseMetadata)
      .filter((exercise): exercise is ExerciseMetadata => exercise !== null);
  },
};
