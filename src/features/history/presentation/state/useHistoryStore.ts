import { create } from 'zustand';
import { CompletedWorkout } from '../../domain/entities/CompletedWorkout';
import { ActiveWorkout } from '../../../workouts/domain/entities/ActiveWorkout';

interface HistoryState {
  completedWorkouts: CompletedWorkout[];
  addCompletedWorkout: (workout: ActiveWorkout) => void;
  updateCompletedWorkoutName: (id: string, name: string) => void;
  deleteCompletedWorkout: (id: string) => void;
  targetMuscleGroups: Record<string, string[]>;
  addTargetMuscleGroup: (dateString: string, muscleGroup: string) => void;
  removeTargetMuscleGroup: (dateString: string, muscleGroup: string) => void;
  customExercises: Record<string, string[]>;
  addCustomExercise: (category: string, exerciseName: string) => void;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  completedWorkouts: [],
  targetMuscleGroups: {},
  addTargetMuscleGroup: (dateString, muscleGroup) => {
    set((state) => {
      const currentGroups = state.targetMuscleGroups[dateString] || [];
      if (currentGroups.includes(muscleGroup)) return state;
      return {
        targetMuscleGroups: {
          ...state.targetMuscleGroups,
          [dateString]: [...currentGroups, muscleGroup],
        },
      };
    });
  },
  removeTargetMuscleGroup: (dateString, muscleGroup) => {
    set((state) => {
      const currentGroups = state.targetMuscleGroups[dateString] || [];
      return {
        targetMuscleGroups: {
          ...state.targetMuscleGroups,
          [dateString]: currentGroups.filter((g) => g !== muscleGroup),
        },
      };
    });
  },
  customExercises: {},
  addCustomExercise: (category, exerciseName) => {
    set((state) => {
      const currentList = state.customExercises[category] || [];
      // Don't add if empty or already exists (case insensitive check)
      if (!exerciseName.trim() || currentList.some(ex => ex.toLowerCase() === exerciseName.toLowerCase())) {
        return state;
      }
      return {
        customExercises: {
          ...state.customExercises,
          [category]: [...currentList, exerciseName.trim()],
        },
      };
    });
  },
  addCompletedWorkout: (workout) => {
    const totalVolume = workout.sets
      .filter(s => s.completed)
      .reduce((sum, s) => sum + (s.weight * s.reps), 0);
      
    const totalSets = workout.sets.filter(s => s.completed).length;

    const completedWorkout: CompletedWorkout = {
      id: Math.random().toString(36).substr(2, 9),
      name: workout.name,
      category: workout.category,
      startTime: workout.startTime,
      endTime: workout.endTime || new Date(),
      totalVolume,
      totalSets,
      workoutData: workout,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set((state) => ({
      completedWorkouts: [completedWorkout, ...state.completedWorkouts],
    }));
  },
  updateCompletedWorkoutName: (id, name) => {
    set((state) => ({
      completedWorkouts: state.completedWorkouts.map(w =>
        w.id === id ? { ...w, name, updatedAt: new Date() } : w
      ),
    }));
  },
  deleteCompletedWorkout: (id) => {
    set((state) => ({
      completedWorkouts: state.completedWorkouts.filter(w => w.id !== id),
    }));
  },
}));
