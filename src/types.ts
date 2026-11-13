/**
 * Domain models shared by every module.
 *
 * These mirror the documents stored by the backend (see `backend/models`),
 * with `Date` where the API sends ISO strings — `services/api.ts` is the only
 * place allowed to do that conversion.
 */

export const EQUIPMENT_TYPES = ['dumbbell', 'barbell', 'machine', 'cable', 'bodyweight'] as const;

export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

/** Default used by both the app and the backend when equipment is unknown. */
export const DEFAULT_EQUIPMENT_TYPE: EquipmentType = 'barbell';

export interface Entity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/** A built-in exercise from the catalogue in `constants/exercises.ts`. */
export interface ExerciseMetadata {
  name: string;
  aliases?: readonly string[];
  muscleGroup: import('./constants/exercises').MuscleGroup;
  equipmentType: EquipmentType;
  primaryMuscles: readonly import('./constants/muscles').MuscleId[];
  secondaryMuscles: readonly import('./constants/muscles').MuscleId[];
  stabilizerMuscles?: readonly import('./constants/muscles').MuscleId[];
  notes?: string;
}

/** An exercise the user added themselves, stored per muscle-group category. */
export interface CustomExercise {
  name: string;
  equipmentType: EquipmentType;
  primaryMuscles?: readonly import('./constants/muscles').MuscleId[];
  secondaryMuscles?: readonly import('./constants/muscles').MuscleId[];
  stabilizerMuscles?: readonly import('./constants/muscles').MuscleId[];
}

export interface WorkoutSet extends Entity {
  exerciseId: string;
  weight: number;
  reps: number;
  completed: boolean;
  isWarmup?: boolean;
  rir?: number;
}

/** A workout in progress. One workout tracks one exercise. */
export interface ActiveWorkout extends Entity {
  name: string;
  templateId?: string;
  category?: string;
  equipmentType?: EquipmentType;
  primaryMuscles?: readonly import('./constants/muscles').MuscleId[];
  secondaryMuscles?: readonly import('./constants/muscles').MuscleId[];
  stabilizerMuscles?: readonly import('./constants/muscles').MuscleId[];
  startTime: Date;
  endTime?: Date;
  sets: WorkoutSet[];
}

/** A finished workout, as kept in history and synced to the backend. */
export interface CompletedWorkout extends Entity {
  name: string;
  category?: string;
  equipmentType?: EquipmentType;
  primaryMuscles?: readonly import('./constants/muscles').MuscleId[];
  secondaryMuscles?: readonly import('./constants/muscles').MuscleId[];
  stabilizerMuscles?: readonly import('./constants/muscles').MuscleId[];
  startTime: Date;
  endTime: Date;
  totalVolume: number;
  totalSets: number;
  workoutData: ActiveWorkout;
}

/** Muscle groups targeted on a given day, keyed by `YYYY-MM-DD`. */
export type TargetMuscleGroups = Record<string, string[]>;

/** Custom exercises keyed by muscle-group category. */
export type CustomExercisesByCategory = Record<string, CustomExercise[]>;

/* -------------------------------------------------------------------------- */
/*                               Nutrition Types                              */
/* -------------------------------------------------------------------------- */

import type { FoodCategory } from './constants/nutrition';
export type { FoodCategory };

export const MEAL_TYPES = ['breakfast', 'lunch', 'snacks', 'dinner'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
};

export const SEXES = ['male', 'female'] as const;
export type Sex = (typeof SEXES)[number];

export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const NUTRITION_GOALS = ['cut', 'maintain', 'bulk'] as const;
export type NutritionGoal = (typeof NUTRITION_GOALS)[number];

export const FOOD_BASES = ['per_100g', 'per_100ml', 'per_piece'] as const;
export type FoodBasis = (typeof FOOD_BASES)[number];

export interface MacroNutrients {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodServing {
  label: string;
  grams: number;
}

export interface FoodItem {
  name: string;
  aliases?: readonly string[];
  category: FoodCategory;
  basis: FoodBasis;
  macros: MacroNutrients;
  servings?: readonly FoodServing[];
  defaultQuantity?: number;
  notes?: string;
}

export interface CustomFood extends FoodItem {
  id: string;
}

export interface LoggedFood extends Entity {
  dateString: string;
  mealType: MealType;
  foodName: string;
  basis: FoodBasis;
  quantity: number;
  servingLabel?: string;
  macros: MacroNutrients;
  foodId?: string;
  loggedAt: Date;
}

export interface UserProfile extends Entity {
  sex: Sex;
  heightCm: number;
  weightKg: number;
  birthDate: Date;
  activityLevel: ActivityLevel;
  goal: NutritionGoal;
  bodyFatPercent?: number;
  maintenanceOverride?: number;
  proteinPerKg?: number;
}

