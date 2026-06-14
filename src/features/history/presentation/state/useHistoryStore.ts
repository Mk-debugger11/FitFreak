import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CompletedWorkout } from '../../domain/entities/CompletedWorkout';
import { ActiveWorkout } from '../../../workouts/domain/entities/ActiveWorkout';
import { useSyncStore } from '../../../../core/sync/useSyncStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface HistoryState {
  isLoading: boolean;
  completedWorkouts: CompletedWorkout[];
  targetMuscleGroups: Record<string, string[]>;
  customExercises: Record<string, { name: string; equipmentType: string }[]>;
  fetchedDates: Record<string, boolean>;
  fetchData: () => Promise<void>;
  fetchWorkoutsForDate: (date: Date) => Promise<void>;
  addCompletedWorkout: (workout: ActiveWorkout) => void;
  updateCompletedWorkoutName: (id: string, name: string) => void;
  deleteCompletedWorkout: (id: string) => void;
  addTargetMuscleGroup: (dateString: string, muscleGroup: string) => void;
  removeTargetMuscleGroup: (dateString: string, muscleGroup: string) => void;
  addCustomExercise: (category: string, exerciseName: string, equipmentType: string) => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      isLoading: true,
      completedWorkouts: [],
      targetMuscleGroups: {},
      customExercises: {},
      fetchedDates: {},
      fetchData: async () => {
        try {
          // Only show full-screen loading if we don't have any cached data
          if (useHistoryStore.getState().completedWorkouts.length === 0) {
            set({ isLoading: true });
          }
          
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          
          const [workoutsRes, musclesRes, customRes] = await Promise.all([
            fetch(`${API_URL}/workouts?startDate=${sevenDaysAgo.toISOString()}`),
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

          const newFetchedDates: Record<string, boolean> = {};
          for (let i = 0; i <= 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            newFetchedDates[d.toISOString().split('T')[0]] = true;
          }

          set((state) => {
            const parsedWorkouts = workouts.map((w: any) => ({
              ...w,
              startTime: new Date(w.startTime),
              endTime: new Date(w.endTime),
              createdAt: new Date(w.createdAt),
              updatedAt: new Date(w.updatedAt),
            }));

            // Merge with existing avoiding duplicates
            const existingIds = new Set(state.completedWorkouts.map(w => w.id));
            const newWorkouts = parsedWorkouts.filter((w: any) => !existingIds.has(w.id));
            
            return {
              completedWorkouts: [...state.completedWorkouts, ...newWorkouts].sort((a, b) => b.startTime.getTime() - a.startTime.getTime()),
              targetMuscleGroups: { ...state.targetMuscleGroups, ...targetMuscleGroups },
              customExercises: { ...state.customExercises, ...customExercises },
              fetchedDates: { ...state.fetchedDates, ...newFetchedDates },
              isLoading: false,
            };
          });
        } catch (err) {
          console.error('Failed to fetch data from MongoDB', err);
          set({ isLoading: false });
        }
      },
      fetchWorkoutsForDate: async (date) => {
        const dateKey = date.toISOString().split('T')[0];
        if (useHistoryStore.getState().fetchedDates[dateKey]) return;

        try {
          const startOfDay = new Date(date);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(date);
          endOfDay.setHours(23, 59, 59, 999);

          const res = await fetch(`${API_URL}/workouts?startDate=${startOfDay.toISOString()}&endDate=${endOfDay.toISOString()}`);
          const workouts = await res.json();

          const parsedWorkouts = workouts.map((w: any) => ({
            ...w,
            startTime: new Date(w.startTime),
            endTime: new Date(w.endTime),
            createdAt: new Date(w.createdAt),
            updatedAt: new Date(w.updatedAt),
          }));

          set((state) => {
            const existingIds = new Set(state.completedWorkouts.map(w => w.id));
            const newWorkouts = parsedWorkouts.filter((w: any) => !existingIds.has(w.id));
            return {
              completedWorkouts: [...state.completedWorkouts, ...newWorkouts].sort((a, b) => b.startTime.getTime() - a.startTime.getTime()),
              fetchedDates: { ...state.fetchedDates, [dateKey]: true }
            };
          });
        } catch (err) {
          console.error('Failed to fetch workouts for date', err);
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
        useSyncStore.getState().enqueueRequest(`${API_URL}/target-muscles`, 'POST', { dateString, muscleGroup });
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
        useSyncStore.getState().enqueueRequest(`${API_URL}/target-muscles`, 'DELETE', { dateString, muscleGroup });
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
        useSyncStore.getState().enqueueRequest(`${API_URL}/custom-exercises`, 'POST', { category, exerciseName, equipmentType });
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

        useSyncStore.getState().enqueueRequest(`${API_URL}/workouts`, 'POST', completedWorkout);
      },
      updateCompletedWorkoutName: (id, name) => {
        set((state) => ({
          completedWorkouts: state.completedWorkouts.map(w =>
            w.id === id ? { ...w, name, updatedAt: new Date() } : w
          ),
        }));
        useSyncStore.getState().enqueueRequest(`${API_URL}/workouts/${id}/name`, 'PUT', { name });
      },
      deleteCompletedWorkout: (id) => {
        set((state) => ({
          completedWorkouts: state.completedWorkouts.filter(w => w.id !== id),
        }));
        useSyncStore.getState().enqueueRequest(`${API_URL}/workouts/${id}`, 'DELETE');
      },
    }),
    {
      name: 'history-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = false; // Turn off loading when rehydrated
          state.completedWorkouts = state.completedWorkouts.map((w: any) => ({
            ...w,
            startTime: new Date(w.startTime),
            endTime: new Date(w.endTime),
            createdAt: new Date(w.createdAt),
            updatedAt: new Date(w.updatedAt),
          }));
        }
      },
    }
  )
);
