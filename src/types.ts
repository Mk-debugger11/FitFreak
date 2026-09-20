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
  muscleGroup: string;
  equipmentType: EquipmentType;
}

/** An exercise the user added themselves, stored per muscle-group category. */
export interface CustomExercise {
  name: string;
  equipmentType: EquipmentType;
}

export interface WorkoutSet extends Entity {
  exerciseId: string;
  weight: number;
  reps: number;
  completed: boolean;
}

/** A workout in progress. One workout tracks one exercise. */
export interface ActiveWorkout extends Entity {
  name: string;
  templateId?: string;
  category?: string;
  equipmentType?: EquipmentType;
  startTime: Date;
  endTime?: Date;
  sets: WorkoutSet[];
}

/** A finished workout, as kept in history and synced to the backend. */
export interface CompletedWorkout extends Entity {
  name: string;
  category?: string;
  equipmentType?: EquipmentType;
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
