import { create } from 'zustand';
import { CompletedWorkout } from '../../domain/entities/CompletedWorkout';
import { ActiveWorkout } from '../../../workouts/domain/entities/ActiveWorkout';
const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface HistoryState {
  isLoading: boolean;
  completedWorkouts: CompletedWorkout[];
  targetMuscleGroups: Record<string, string[]>;
  customExercises: Record<string, { name: string; equipmentType: string }[]>;
  fetchData: () => Promise<void>;
  addCompletedWorkout: (workout: ActiveWorkout) => void;
  updateCompletedWorkoutName: (id: string, name: string) => void;
  deleteCompletedWorkout: (id: string) => void;
  addTargetMuscleGroup: (dateString: string, muscleGroup: string) => void;
  removeTargetMuscleGroup: (dateString: string, muscleGroup: string) => void;
  addCustomExercise: (category: string, exerciseName: string, equipmentType: string) => void;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  isLoading: true,
  completedWorkouts: [],
  targetMuscleGroups: {},
  customExercises: {},
  fetchData: async () => {
    try {
      set({ isLoading: true });
      const [workoutsRes, musclesRes, customRes] = await Promise.all([
        fetch(`${API_URL}/workouts`),
        fetch(`${API_URL}/target-muscles`),
        fetch(`${API_URL}/custom-exercises`)
      ]);
      const workouts = await workoutsRes.json();
      const musclesData = await musclesRes.json();
      const customData = await customRes.json();

      const targetMuscleGroups: Record<string, string[]> = {};
      musclesData.forEach((m: any) => {
        targetMuscleGroups[m.dateString] = m.muscles;
      });

      const customExercises: Record<string, { name: string; equipmentType: string }[]> = {};
      customData.forEach((c: any) => {
        customExercises[c.category] = c.exercises.map((ex: any) => {
          if (typeof ex === 'string') return { name: ex, equipmentType: 'barbell' };
          return ex;
        });
      });

      set({
        completedWorkouts: workouts.map((w: any) => ({
          ...w,
          startTime: new Date(w.startTime),
          endTime: new Date(w.endTime),
          createdAt: new Date(w.createdAt),
          updatedAt: new Date(w.updatedAt),
        })),
        targetMuscleGroups,
        customExercises,
        isLoading: false,
      });
    } catch (err) {
      console.error('Failed to fetch data from MongoDB', err);
      set({ isLoading: false });
    }
  },
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
    fetch(`${API_URL}/target-muscles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateString, muscleGroup })
    }).catch(console.error);
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
    fetch(`${API_URL}/target-muscles`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateString, muscleGroup })
    }).catch(console.error);
  },
  addCustomExercise: (category, exerciseName, equipmentType) => {
    set((state) => {
      const currentList = state.customExercises[category] || [];
      if (!exerciseName.trim() || currentList.some(ex => ex.name.toLowerCase() === exerciseName.toLowerCase())) {
        return state;
      }
      return {
        customExercises: {
          ...state.customExercises,
          [category]: [...currentList, { name: exerciseName.trim(), equipmentType }],
        },
      };
    });
    fetch(`${API_URL}/custom-exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, exerciseName, equipmentType })
    }).catch(console.error);
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

    fetch(`${API_URL}/workouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(completedWorkout)
    }).catch(console.error);
  },
  updateCompletedWorkoutName: (id, name) => {
    set((state) => ({
      completedWorkouts: state.completedWorkouts.map(w =>
        w.id === id ? { ...w, name, updatedAt: new Date() } : w
      ),
    }));
    fetch(`${API_URL}/workouts/${id}/name`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    }).catch(console.error);
  },
  deleteCompletedWorkout: (id) => {
    set((state) => ({
      completedWorkouts: state.completedWorkouts.filter(w => w.id !== id),
    }));
    fetch(`${API_URL}/workouts/${id}`, {
      method: 'DELETE'
    }).catch(console.error);
  },
}));
