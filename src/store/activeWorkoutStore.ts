/**
 * The workout currently being logged. One workout tracks one exercise; when it
 * is finished it is handed to the history store to be saved and synced.
 */
import { create } from 'zustand';
import { MuscleId } from '../constants/muscles';
import { ActiveWorkout, EquipmentType, WorkoutSet } from '../types';
import { resolveExerciseMuscles } from '../utils/exercise';
import { createId } from '../utils/id';

interface StartWorkoutOptions {
  templateId?: string;
  startTime?: Date;
  category?: string;
  equipmentType?: EquipmentType;
  primaryMuscles?: readonly MuscleId[];
  secondaryMuscles?: readonly MuscleId[];
  stabilizerMuscles?: readonly MuscleId[];
}

interface ActiveWorkoutState {
  currentWorkout: ActiveWorkout | null;
  isMinimized: boolean;
  startWorkout: (name: string, options?: StartWorkoutOptions) => void;
  /** Minimizes the active workout sheet into the persistent bar when active and expanded. */
  minimizeWorkout: () => void;
  /** Re-expands the minimized active workout sheet when active and minimized. */
  resumeWorkout: () => void;
  updateWorkoutName: (name: string) => void;
  addSet: (exerciseId: string, weight: number, reps: number) => void;
  updateSet: (setId: string, weight: number, reps: number) => void;
  deleteSet: (setId: string) => void;
  toggleSetComplete: (setId: string) => void;
  toggleSetWarmup: (setId: string) => void;
  /** Clears the workout and returns it, ready to be stored in history. */
  finishWorkout: () => ActiveWorkout | null;
  cancelWorkout: () => void;
}

/** Zustand store managing the workout session currently being logged. */
export const useActiveWorkoutStore = create<ActiveWorkoutState>((set, get) => {
  /** Applies a change to the workout in progress, touching `updatedAt`. */
  const updateWorkout = (change: (workout: ActiveWorkout) => Partial<ActiveWorkout>): void => {
    const { currentWorkout } = get();
    if (!currentWorkout) return;

    set({
      currentWorkout: {
        ...currentWorkout,
        ...change(currentWorkout),
        updatedAt: new Date(),
      },
    });
  };

  /** Applies a change to one set of the workout in progress. */
  const updateSetById = (setId: string, change: (set: WorkoutSet) => Partial<WorkoutSet>): void =>
    updateWorkout((workout) => ({
      sets: workout.sets.map((workoutSet) =>
        workoutSet.id === setId
          ? { ...workoutSet, ...change(workoutSet), updatedAt: new Date() }
          : workoutSet,
      ),
    }));

  return {
    currentWorkout: null,
    isMinimized: false,

    startWorkout: (name, options = {}) => {
      const now = new Date();
      const targets = resolveExerciseMuscles(name, options.category, {
        primaryMuscles: options.primaryMuscles,
        secondaryMuscles: options.secondaryMuscles,
        stabilizerMuscles: options.stabilizerMuscles,
      });
      set({
        currentWorkout: {
          id: createId(),
          name,
          templateId: options.templateId,
          category: options.category,
          equipmentType: options.equipmentType,
          ...(targets
            ? {
                primaryMuscles: targets.primary,
                secondaryMuscles: targets.secondary,
                stabilizerMuscles: targets.stabilizers,
              }
            : {}),
          startTime: options.startTime ?? now,
          sets: [],
          createdAt: now,
          updatedAt: now,
        },
        isMinimized: false,
      });
    },

    minimizeWorkout: () => {
      if (get().currentWorkout !== null && !get().isMinimized) {
        set({ isMinimized: true });
      }
    },

    resumeWorkout: () => {
      if (get().currentWorkout !== null && get().isMinimized) {
        set({ isMinimized: false });
      }
    },

    updateWorkoutName: (name) =>
      updateWorkout((workout) => {
        const targets = resolveExerciseMuscles(name, workout.category);
        return {
          name,
          primaryMuscles: targets?.primary,
          secondaryMuscles: targets?.secondary,
          stabilizerMuscles: targets?.stabilizers,
        };
      }),

    addSet: (exerciseId, weight, reps) =>
      updateWorkout((workout) => {
        const now = new Date();
        const newSet: WorkoutSet = {
          id: createId(),
          exerciseId,
          weight,
          reps,
          completed: false,
          createdAt: now,
          updatedAt: now,
        };
        return { sets: [...workout.sets, newSet] };
      }),

    updateSet: (setId, weight, reps) => updateSetById(setId, () => ({ weight, reps })),

    deleteSet: (setId) =>
      updateWorkout((workout) => ({
        sets: workout.sets.filter((workoutSet) => workoutSet.id !== setId),
      })),

    toggleSetComplete: (setId) =>
      updateSetById(setId, (workoutSet) => ({ completed: !workoutSet.completed })),

    toggleSetWarmup: (setId) =>
      updateSetById(setId, (workoutSet) => ({
        isWarmup: workoutSet.isWarmup === true ? false : true,
      })),

    finishWorkout: () => {
      const { currentWorkout } = get();
      if (!currentWorkout) return null;

      const finished: ActiveWorkout = {
        ...currentWorkout,
        endTime: new Date(),
        updatedAt: new Date(),
      };

      set({ currentWorkout: null, isMinimized: false });
      return finished;
    },

    cancelWorkout: () => set({ currentWorkout: null, isMinimized: false }),
  };
});
