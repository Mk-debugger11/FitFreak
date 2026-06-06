import { create } from 'zustand';
import { ActiveWorkout } from '../../domain/entities/ActiveWorkout';
import { WorkoutSet } from '../../domain/entities/WorkoutSet';

interface ActiveWorkoutState {
  currentWorkout: ActiveWorkout | null;
  startWorkout: (name: string, templateId?: string, startTime?: Date, category?: string) => void;
  updateWorkoutName: (name: string) => void;
  addSet: (exerciseId: string, weight: number, reps: number) => void;
  updateSet: (setId: string, weight: number, reps: number) => void;
  deleteSet: (setId: string) => void;
  toggleSetComplete: (setId: string) => void;
  finishWorkout: () => ActiveWorkout | null; // Returns completed workout to be saved in history
  cancelWorkout: () => void;
}

export const useActiveWorkoutStore = create<ActiveWorkoutState>((set, get) => ({
  currentWorkout: null,

  startWorkout: (name, templateId, startTime, category) => {
    const newWorkout: ActiveWorkout = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      templateId,
      category,
      startTime: startTime || new Date(),
      sets: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set({ currentWorkout: newWorkout });
  },

  updateWorkoutName: (name) => {
    const { currentWorkout } = get();
    if (!currentWorkout) return;

    set({
      currentWorkout: {
        ...currentWorkout,
        name,
        updatedAt: new Date(),
      }
    });
  },

  addSet: (exerciseId, weight, reps) => {
    const { currentWorkout } = get();
    if (!currentWorkout) return;

    const newSet: WorkoutSet = {
      id: Math.random().toString(36).substr(2, 9),
      exerciseId,
      weight,
      reps,
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set({
      currentWorkout: {
        ...currentWorkout,
        sets: [...currentWorkout.sets, newSet],
        updatedAt: new Date(),
      }
    });
  },

  updateSet: (setId, weight, reps) => {
    const { currentWorkout } = get();
    if (!currentWorkout) return;

    const updatedSets = currentWorkout.sets.map(s => 
      s.id === setId ? { ...s, weight, reps, updatedAt: new Date() } : s
    );

    set({
      currentWorkout: {
        ...currentWorkout,
        sets: updatedSets,
        updatedAt: new Date(),
      }
    });
  },

  deleteSet: (setId) => {
    const { currentWorkout } = get();
    if (!currentWorkout) return;

    const updatedSets = currentWorkout.sets.filter(s => s.id !== setId);

    set({
      currentWorkout: {
        ...currentWorkout,
        sets: updatedSets,
        updatedAt: new Date(),
      }
    });
  },

  toggleSetComplete: (setId) => {
    const { currentWorkout } = get();
    if (!currentWorkout) return;

    const updatedSets = currentWorkout.sets.map(s => 
      s.id === setId ? { ...s, completed: !s.completed, updatedAt: new Date() } : s
    );

    set({
      currentWorkout: {
        ...currentWorkout,
        sets: updatedSets,
        updatedAt: new Date(),
      }
    });
  },

  finishWorkout: () => {
    const { currentWorkout } = get();
    if (!currentWorkout) return null;

    const completedWorkout = {
      ...currentWorkout,
      endTime: new Date(),
      updatedAt: new Date(),
    };

    set({ currentWorkout: null });
    return completedWorkout;
  },

  cancelWorkout: () => {
    set({ currentWorkout: null });
  },
}));
