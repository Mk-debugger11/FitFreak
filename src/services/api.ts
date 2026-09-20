/**
 * The single place that talks to the backend.
 *
 * Reads go through `api.*` and are parsed into domain models here, so the rest
 * of the app never sees an ISO string or an unvalidated payload. Writes are
 * queued by `store/syncStore.ts` (offline-first), which is why the endpoint
 * URLs are exported separately.
 */
import {
  ActiveWorkout,
  CompletedWorkout,
  CustomExercise,
  CustomExercisesByCategory,
  DEFAULT_EQUIPMENT_TYPE,
  TargetMuscleGroups,
  WorkoutSet,
} from '../types';
import { parseEquipmentType } from '../utils/exercise';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

/** Absolute URLs, also used as the identity of a queued offline mutation. */
export const endpoints = {
  workouts: `${API_URL}/workouts`,
  workout: (id: string) => `${API_URL}/workouts/${id}`,
  workoutName: (id: string) => `${API_URL}/workouts/${id}/name`,
  targetMuscles: `${API_URL}/target-muscles`,
  customExercises: `${API_URL}/custom-exercises`,
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
  exercises: (string | { name: string; equipmentType?: string })[];
}

// --- Parsers ----------------------------------------------------------------

const parseSet = (dto: Json): WorkoutSet => ({
  id: String(dto.id),
  exerciseId: String(dto.exerciseId),
  weight: Number(dto.weight) || 0,
  reps: Number(dto.reps) || 0,
  completed: Boolean(dto.completed),
  createdAt: new Date(dto.createdAt),
  updatedAt: new Date(dto.updatedAt),
});

const parseActiveWorkout = (dto: Json): ActiveWorkout => ({
  id: String(dto.id),
  name: dto.name ?? '',
  templateId: dto.templateId ?? undefined,
  category: dto.category ?? undefined,
  equipmentType: parseEquipmentType(dto.equipmentType),
  startTime: new Date(dto.startTime),
  endTime: dto.endTime ? new Date(dto.endTime) : undefined,
  sets: Array.isArray(dto.sets) ? dto.sets.map(parseSet) : [],
  createdAt: new Date(dto.createdAt),
  updatedAt: new Date(dto.updatedAt),
});

export const parseCompletedWorkout = (dto: Json): CompletedWorkout => ({
  id: String(dto.id),
  name: dto.name ?? '',
  category: dto.category ?? undefined,
  equipmentType: parseEquipmentType(dto.equipmentType),
  startTime: new Date(dto.startTime),
  endTime: new Date(dto.endTime),
  totalVolume: Number(dto.totalVolume) || 0,
  totalSets: Number(dto.totalSets) || 0,
  workoutData: parseActiveWorkout(dto.workoutData ?? {}),
  createdAt: new Date(dto.createdAt),
  updatedAt: new Date(dto.updatedAt),
});

const parseCustomExercise = (dto: CustomExerciseDto['exercises'][number]): CustomExercise =>
  typeof dto === 'string'
    ? { name: dto, equipmentType: DEFAULT_EQUIPMENT_TYPE }
    : { name: dto.name, equipmentType: parseEquipmentType(dto.equipmentType) ?? DEFAULT_EQUIPMENT_TYPE };

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
    return Object.fromEntries(dtos.map((dto) => [dto.dateString, dto.muscles]));
  },

  async getCustomExercises(): Promise<CustomExercisesByCategory> {
    const dtos = await getJson<CustomExerciseDto[]>(endpoints.customExercises);
    return Object.fromEntries(dtos.map((dto) => [dto.category, dto.exercises.map(parseCustomExercise)]));
  },
};
