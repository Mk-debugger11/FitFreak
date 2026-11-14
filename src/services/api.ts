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
  ActivityLevel,
  ACTIVITY_LEVELS,
  CompletedWorkout,
  CustomExercise,
  CustomExercisesByCategory,
  CustomFood,
  DEFAULT_EQUIPMENT_TYPE,
  ExerciseMetadata,
  FoodItem,
  FoodServing,
  LoggedFood,
  MacroNutrients,
  MealType,
  MEAL_TYPES,
  NutritionGoal,
  NUTRITION_GOALS,
  Sex,
  SEXES,
  TargetMuscleGroups,
  UserProfile,
  WorkoutSet,
} from '../types';
import { parseEquipmentType } from '../utils/exercise';
import { isFoodBasis, isFoodCategory } from '../utils/food';
import { caloriesFromMacros } from '../features/nutrition/servingMath';

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
  profile: `${API_URL}/profile`,
  foods: `${API_URL}/foods`,
  customFoods: `${API_URL}/custom-foods`,
  customFood: (id: string) => `${API_URL}/custom-foods/${id}`,
  nutritionEntries: `${API_URL}/nutrition-entries`,
  nutritionEntry: (id: string) => `${API_URL}/nutrition-entries/${id}`,
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

const SEX_SET: ReadonlySet<string> = new Set(SEXES);
const isSex = (value: unknown): value is Sex =>
  typeof value === 'string' && SEX_SET.has(value);

const ACTIVITY_LEVEL_SET: ReadonlySet<string> = new Set(ACTIVITY_LEVELS);
const isActivityLevel = (value: unknown): value is ActivityLevel =>
  typeof value === 'string' && ACTIVITY_LEVEL_SET.has(value);

const NUTRITION_GOAL_SET: ReadonlySet<string> = new Set(NUTRITION_GOALS);
const isNutritionGoal = (value: unknown): value is NutritionGoal =>
  typeof value === 'string' && NUTRITION_GOAL_SET.has(value);

const MEAL_TYPE_SET: ReadonlySet<string> = new Set(MEAL_TYPES);
const isMealType = (value: unknown): value is MealType =>
  typeof value === 'string' && MEAL_TYPE_SET.has(value);

/**
 * Validates and parses a user profile DTO from the API or persisted storage.
 * Validates sex, activityLevel, goal, validates finite numbers for heightCm, weightKg,
 * birthDate (parses to Date), bodyFatPercent, maintenanceOverride, proteinPerKg.
 * Returns null if invalid.
 */
export const parseUserProfile = (dto: unknown): UserProfile | null => {
  if (!dto || typeof dto !== 'object') return null;
  const record = dto as Json;

  if (!isSex(record.sex) || !isActivityLevel(record.activityLevel) || !isNutritionGoal(record.goal)) {
    return null;
  }

  const heightCm = typeof record.heightCm === 'number' ? record.heightCm : Number(record.heightCm);
  if (!Number.isFinite(heightCm) || heightCm <= 0) {
    return null;
  }

  const weightKg = typeof record.weightKg === 'number' ? record.weightKg : Number(record.weightKg);
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return null;
  }

  if (!record.birthDate) {
    return null;
  }
  const birthDate = new Date(record.birthDate);
  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  let bodyFatPercent: number | undefined;
  if (record.bodyFatPercent !== undefined && record.bodyFatPercent !== null) {
    const num = typeof record.bodyFatPercent === 'number' ? record.bodyFatPercent : Number(record.bodyFatPercent);
    if (!Number.isFinite(num) || num < 0) {
      return null;
    }
    bodyFatPercent = num;
  }

  let maintenanceOverride: number | undefined;
  if (record.maintenanceOverride !== undefined && record.maintenanceOverride !== null) {
    const num =
      typeof record.maintenanceOverride === 'number'
        ? record.maintenanceOverride
        : Number(record.maintenanceOverride);
    if (!Number.isFinite(num) || num <= 0) {
      return null;
    }
    maintenanceOverride = num;
  }

  let proteinPerKg: number | undefined;
  if (record.proteinPerKg !== undefined && record.proteinPerKg !== null) {
    const num = typeof record.proteinPerKg === 'number' ? record.proteinPerKg : Number(record.proteinPerKg);
    if (!Number.isFinite(num) || num <= 0) {
      return null;
    }
    proteinPerKg = num;
  }

  const id = String(record.id ?? record._id ?? '');
  const createdAt = record.createdAt ? new Date(record.createdAt) : new Date();
  const updatedAt = record.updatedAt ? new Date(record.updatedAt) : new Date();

  return {
    id,
    sex: record.sex,
    heightCm,
    weightKg,
    birthDate,
    activityLevel: record.activityLevel,
    goal: record.goal,
    ...(bodyFatPercent !== undefined ? { bodyFatPercent } : {}),
    ...(maintenanceOverride !== undefined ? { maintenanceOverride } : {}),
    ...(proteinPerKg !== undefined ? { proteinPerKg } : {}),
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
    updatedAt: Number.isNaN(updatedAt.getTime()) ? new Date() : updatedAt,
  };
};

/**
 * Validates and parses a canonical food item DTO.
 * Validates name, category, basis, macros (finite non-negative, derives calories
 * via caloriesFromMacros if missing), servings.
 * Returns null if invalid.
 */
export const parseFoodItem = (dto: unknown): FoodItem | null => {
  if (!dto || typeof dto !== 'object') return null;
  const record = dto as Json;

  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (!name || !isFoodCategory(record.category) || !isFoodBasis(record.basis)) {
    return null;
  }

  if (!record.macros || typeof record.macros !== 'object') {
    return null;
  }

  const p = typeof record.macros.protein === 'number' ? record.macros.protein : Number(record.macros.protein);
  const c = typeof record.macros.carbs === 'number' ? record.macros.carbs : Number(record.macros.carbs);
  const f = typeof record.macros.fat === 'number' ? record.macros.fat : Number(record.macros.fat);

  if (!Number.isFinite(p) || p < 0 || !Number.isFinite(c) || c < 0 || !Number.isFinite(f) || f < 0) {
    return null;
  }

  const rawCal = record.macros.calories;
  const numCal =
    typeof rawCal === 'number'
      ? rawCal
      : rawCal !== undefined && rawCal !== null
        ? Number(rawCal)
        : NaN;
  const calories =
    Number.isFinite(numCal) && numCal > 0
      ? Math.round(numCal)
      : caloriesFromMacros({ protein: p, carbs: c, fat: f });

  const macros: MacroNutrients = { calories, protein: p, carbs: c, fat: f };

  let servings: FoodServing[] | undefined;
  if (Array.isArray(record.servings)) {
    const parsedServings = record.servings
      .filter((s: unknown) => s && typeof s === 'object')
      .map((s: Json) => ({
        label: typeof s.label === 'string' ? s.label.trim() : '',
        grams: typeof s.grams === 'number' ? s.grams : Number(s.grams),
      }))
      .filter((s) => s.label.length > 0 && Number.isFinite(s.grams) && s.grams > 0);
    if (parsedServings.length > 0) {
      servings = parsedServings;
    }
  }

  const aliases = Array.isArray(record.aliases)
    ? record.aliases
        .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
        .map((a) => a.trim())
    : undefined;

  const defaultQuantity =
    typeof record.defaultQuantity === 'number' &&
    Number.isFinite(record.defaultQuantity) &&
    record.defaultQuantity > 0
      ? record.defaultQuantity
      : typeof record.defaultQuantity === 'string' &&
          Number.isFinite(Number(record.defaultQuantity)) &&
          Number(record.defaultQuantity) > 0
        ? Number(record.defaultQuantity)
        : servings && servings.length > 0
          ? servings[0].grams
          : undefined;

  const notes = typeof record.notes === 'string' && record.notes.trim() ? record.notes.trim() : undefined;

  return {
    name,
    category: record.category,
    basis: record.basis,
    macros,
    ...(aliases && aliases.length > 0 ? { aliases } : {}),
    ...(servings && servings.length > 0 ? { servings } : {}),
    ...(defaultQuantity !== undefined ? { defaultQuantity } : {}),
    ...(notes ? { notes } : {}),
  };
};

/**
 * Validates and parses a user custom food DTO.
 * Validates id, name, category, basis, macros, servings.
 * Returns null if invalid.
 */
export const parseCustomFood = (dto: unknown): CustomFood | null => {
  if (!dto || typeof dto !== 'object') return null;
  const record = dto as Json;
  const id =
    typeof record.id === 'string' && record.id.trim()
      ? record.id.trim()
      : typeof record._id === 'string' && record._id.trim()
        ? record._id.trim()
        : '';
  if (!id) return null;

  const foodItem = parseFoodItem(dto);
  if (!foodItem) return null;

  return {
    ...foodItem,
    id,
  };
};

/**
 * Validates and parses a logged nutrition food entry DTO.
 * Validates id, dateString, mealType, foodName, basis, quantity, servingLabel, macros, foodId, loggedAt (parses to Date).
 * Returns null if invalid.
 */
export const parseLoggedFood = (dto: unknown): LoggedFood | null => {
  if (!dto || typeof dto !== 'object') return null;
  const record = dto as Json;

  const id =
    typeof record.id === 'string' && record.id.trim()
      ? record.id.trim()
      : typeof record._id === 'string' && record._id.trim()
        ? record._id.trim()
        : '';
  if (!id) return null;

  const dateString =
    typeof record.dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.dateString.trim())
      ? record.dateString.trim()
      : null;
  if (!dateString) return null;

  if (!isMealType(record.mealType)) return null;

  const foodName = typeof record.foodName === 'string' ? record.foodName.trim() : '';
  if (!foodName) return null;

  if (!isFoodBasis(record.basis)) return null;

  const quantity = typeof record.quantity === 'number' ? record.quantity : Number(record.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  if (!record.macros || typeof record.macros !== 'object') return null;
  const p = typeof record.macros.protein === 'number' ? record.macros.protein : Number(record.macros.protein);
  const c = typeof record.macros.carbs === 'number' ? record.macros.carbs : Number(record.macros.carbs);
  const f = typeof record.macros.fat === 'number' ? record.macros.fat : Number(record.macros.fat);
  if (!Number.isFinite(p) || p < 0 || !Number.isFinite(c) || c < 0 || !Number.isFinite(f) || f < 0) {
    return null;
  }
  const rawCal = record.macros.calories;
  const numCal =
    typeof rawCal === 'number'
      ? rawCal
      : rawCal !== undefined && rawCal !== null
        ? Number(rawCal)
        : NaN;
  const calories =
    Number.isFinite(numCal) && numCal > 0
      ? Math.round(numCal)
      : caloriesFromMacros({ protein: p, carbs: c, fat: f });
  const macros: MacroNutrients = { calories, protein: p, carbs: c, fat: f };

  if (!record.loggedAt) return null;
  const loggedAt = new Date(record.loggedAt);
  if (Number.isNaN(loggedAt.getTime())) return null;

  const servingLabel =
    typeof record.servingLabel === 'string' && record.servingLabel.trim()
      ? record.servingLabel.trim()
      : undefined;

  const foodId =
    typeof record.foodId === 'string' && record.foodId.trim()
      ? record.foodId.trim()
      : undefined;

  const createdAt = record.createdAt ? new Date(record.createdAt) : loggedAt;
  const updatedAt = record.updatedAt ? new Date(record.updatedAt) : loggedAt;

  return {
    id,
    dateString,
    mealType: record.mealType,
    foodName,
    basis: record.basis,
    quantity,
    ...(servingLabel ? { servingLabel } : {}),
    macros,
    ...(foodId ? { foodId } : {}),
    loggedAt,
    createdAt: Number.isNaN(createdAt.getTime()) ? loggedAt : createdAt,
    updatedAt: Number.isNaN(updatedAt.getTime()) ? loggedAt : updatedAt,
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

  /** Returns null when the profile has not yet been set up (or 404). */
  async getProfile(): Promise<UserProfile | null> {
    const response = await fetch(endpoints.profile);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`GET ${endpoints.profile} failed with status ${response.status}`);
    }
    const dto = (await response.json()) as unknown;
    if (!dto) return null;
    return parseUserProfile(dto);
  },

  /** Returns null when the remote server does not yet expose `/api/foods` (404). */
  async getFoods(): Promise<FoodItem[] | null> {
    const response = await fetch(endpoints.foods);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`GET ${endpoints.foods} failed with status ${response.status}`);
    }
    const dtos = (await response.json()) as unknown[];
    if (!Array.isArray(dtos)) return [];
    return dtos
      .map(parseFoodItem)
      .filter((food): food is FoodItem => food !== null);
  },

  /** Returns all custom foods created by the user. */
  async getCustomFoods(): Promise<CustomFood[]> {
    const dtos = await getJson<unknown[]>(endpoints.customFoods);
    if (!Array.isArray(dtos)) return [];
    return dtos
      .map(parseCustomFood)
      .filter((food): food is CustomFood => food !== null);
  },

  /** Returns logged nutrition entries optionally filtered by date range. */
  async getNutritionEntries(
    params: { startDate?: string; endDate?: string } = {},
  ): Promise<LoggedFood[]> {
    const searchParams = new URLSearchParams();
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);

    const query = searchParams.toString();
    const url = query ? `${endpoints.nutritionEntries}?${query}` : endpoints.nutritionEntries;
    const dtos = await getJson<unknown[]>(url);
    if (!Array.isArray(dtos)) return [];
    return dtos
      .map(parseLoggedFood)
      .filter((entry): entry is LoggedFood => entry !== null);
  },
};
