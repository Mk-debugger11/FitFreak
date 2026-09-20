/**
 * The workout currently being logged. One workout tracks one exercise; when it
 * is finished it is handed to the history store to be saved and synced.
 */
import { create } from 'zustand';
import { ActiveWorkout, EquipmentType, WorkoutSet } from '../types';
import { createId } from '../utils/id';

interface StartWorkoutOptions {
  templateId?: string;
  startTime?: Date;
  category?: string;
  equipmentType?: EquipmentType;
}

interface ActiveWorkoutState {
  currentWorkout: ActiveWorkout | null;
  startWorkout: (name: string, options?: StartWorkoutOptions) => void;
  updateWorkoutName: (name: string) => void;
  addSet: (exerciseId: string, weight: number, reps: number) => void;
  updateSet: (setId: string, weight: number, reps: number) => void;
  deleteSet: (setId: string) => void;
  toggleSetComplete: (setId: string) => void;
  /** Clears the workout and returns it, ready to be stored in history. */
  finishWorkout: () => ActiveWorkout | null;
  cancelWorkout: () => void;
}

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

    startWorkout: (name, options = {}) => {
      const now = new Date();
      set({
        currentWorkout: {
          id: createId(),
          name,
          templateId: options.templateId,
          category: options.category,
          equipmentType: options.equipmentType,
          startTime: options.startTime ?? now,
          sets: [],
          createdAt: now,
          updatedAt: now,
        },
      });
    },

    updateWorkoutName: (name) => updateWorkout(() => ({ name })),

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

    finishWorkout: () => {
      const { currentWorkout } = get();
      if (!currentWorkout) return null;

      const finished: ActiveWorkout = {
        ...currentWorkout,
        endTime: new Date(),
        updatedAt: new Date(),
      };

      set({ currentWorkout: null });
      return finished;
    },

    cancelWorkout: () => set({ currentWorkout: null }),
  };
});
