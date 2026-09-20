/**
 * Completed workouts, target muscle groups and custom exercises.
 *
 * Reads hit the API and are cached in AsyncStorage so the app opens instantly
 * and works offline; writes update local state first and are queued for sync.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { api, endpoints, parseCompletedWorkout } from '../services/api';
import {
  ActiveWorkout,
  CompletedWorkout,
  CustomExercisesByCategory,
  DEFAULT_EQUIPMENT_TYPE,
  EquipmentType,
  TargetMuscleGroups,
} from '../types';
import { addDays, endOfDay, startOfDay, toFetchKey } from '../utils/date';
import { parseEquipmentType } from '../utils/exercise';
import { createId } from '../utils/id';
import { enqueueSync } from './syncStore';

/** How many days of history to pull on a cold start. */
const INITIAL_HISTORY_DAYS = 7;

interface HistoryState {
  isLoading: boolean;
  completedWorkouts: CompletedWorkout[];
  targetMuscleGroups: TargetMuscleGroups;
  customExercises: CustomExercisesByCategory;
  /** Date keys (UTC `YYYY-MM-DD`) already fetched, so we don't refetch them. */
  fetchedDates: Record<string, boolean>;

  fetchData: () => Promise<void>;
  fetchWorkoutsForDate: (date: Date) => Promise<void>;
  addCompletedWorkout: (workout: ActiveWorkout) => void;
  updateCompletedWorkoutName: (id: string, name: string) => void;
  deleteCompletedWorkout: (id: string) => void;
  addTargetMuscleGroup: (dateKey: string, muscleGroup: string) => void;
  removeTargetMuscleGroup: (dateKey: string, muscleGroup: string) => void;
  addCustomExercise: (category: string, exerciseName: string, equipmentType: EquipmentType) => void;
}

const byNewestFirst = (a: CompletedWorkout, b: CompletedWorkout) =>
  b.startTime.getTime() - a.startTime.getTime();

/** Adds only the workouts we don't already hold, keeping the list sorted. */
const mergeWorkouts = (existing: CompletedWorkout[], incoming: CompletedWorkout[]): CompletedWorkout[] => {
  const knownIds = new Set(existing.map((workout) => workout.id));
  const added = incoming.filter((workout) => !knownIds.has(workout.id));
  return [...existing, ...added].sort(byNewestFirst);
};

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      isLoading: true,
      completedWorkouts: [],
      targetMuscleGroups: {},
      customExercises: {},
      fetchedDates: {},

      fetchData: async () => {
        try {
          // Only block the UI when there's nothing cached to show.
          if (get().completedWorkouts.length === 0) {
            set({ isLoading: true });
          }

          const [workouts, targetMuscleGroups, customExercises] = await Promise.all([
            api.getWorkouts({ startDate: addDays(new Date(), -INITIAL_HISTORY_DAYS) }),
            api.getTargetMuscles(),
            api.getCustomExercises(),
          ]);

          const fetchedDates: Record<string, boolean> = {};
          for (let dayOffset = 0; dayOffset <= INITIAL_HISTORY_DAYS; dayOffset += 1) {
            fetchedDates[toFetchKey(addDays(new Date(), -dayOffset))] = true;
          }

          set((state) => ({
            completedWorkouts: mergeWorkouts(state.completedWorkouts, workouts),
            targetMuscleGroups: { ...state.targetMuscleGroups, ...targetMuscleGroups },
            customExercises: { ...state.customExercises, ...customExercises },
            fetchedDates: { ...state.fetchedDates, ...fetchedDates },
            isLoading: false,
          }));
        } catch (error) {
          console.error('Failed to fetch data from MongoDB', error);
          set({ isLoading: false });
        }
      },

      fetchWorkoutsForDate: async (date) => {
        const dateKey = toFetchKey(date);
        if (get().fetchedDates[dateKey]) return;

        try {
          const workouts = await api.getWorkouts({
            startDate: startOfDay(date),
            endDate: endOfDay(date),
          });

          set((state) => ({
            completedWorkouts: mergeWorkouts(state.completedWorkouts, workouts),
            fetchedDates: { ...state.fetchedDates, [dateKey]: true },
          }));
        } catch (error) {
          console.error('Failed to fetch workouts for date', error);
        }
      },

      addCompletedWorkout: (workout) => {
        const completedSets = workout.sets.filter((set) => set.completed);

        const completedWorkout: CompletedWorkout = {
          id: createId(),
          name: workout.name,
          category: workout.category,
          equipmentType: workout.equipmentType,
          startTime: workout.startTime,
          endTime: workout.endTime ?? new Date(),
          totalVolume: completedSets.reduce((total, set) => total + set.weight * set.reps, 0),
          totalSets: completedSets.length,
          workoutData: workout,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set((state) => ({
          completedWorkouts: [completedWorkout, ...state.completedWorkouts],
        }));

        enqueueSync(endpoints.workouts, 'POST', completedWorkout);
      },

      updateCompletedWorkoutName: (id, name) => {
        set((state) => ({
          completedWorkouts: state.completedWorkouts.map((workout) =>
            workout.id === id ? { ...workout, name, updatedAt: new Date() } : workout,
          ),
        }));

        enqueueSync(endpoints.workoutName(id), 'PUT', { name });
      },

      deleteCompletedWorkout: (id) => {
        set((state) => ({
          completedWorkouts: state.completedWorkouts.filter((workout) => workout.id !== id),
        }));

        enqueueSync(endpoints.workout(id), 'DELETE');
      },

      addTargetMuscleGroup: (dateKey, muscleGroup) => {
        const current = get().targetMuscleGroups[dateKey] ?? [];
        if (current.includes(muscleGroup)) return;

        set((state) => ({
          targetMuscleGroups: {
            ...state.targetMuscleGroups,
            [dateKey]: [...current, muscleGroup],
          },
        }));

        enqueueSync(endpoints.targetMuscles, 'POST', { dateString: dateKey, muscleGroup });
      },

      removeTargetMuscleGroup: (dateKey, muscleGroup) => {
        set((state) => ({
          targetMuscleGroups: {
            ...state.targetMuscleGroups,
            [dateKey]: (state.targetMuscleGroups[dateKey] ?? []).filter((group) => group !== muscleGroup),
          },
        }));

        enqueueSync(endpoints.targetMuscles, 'DELETE', { dateString: dateKey, muscleGroup });
      },

      addCustomExercise: (category, exerciseName, equipmentType) => {
        const name = exerciseName.trim();
        const current = get().customExercises[category] ?? [];
        const alreadyExists = current.some(
          (exercise) => exercise.name.toLowerCase() === name.toLowerCase(),
        );
        if (!name || alreadyExists) return;

        set((state) => ({
          customExercises: {
            ...state.customExercises,
            [category]: [...current, { name, equipmentType }],
          },
        }));

        enqueueSync(endpoints.customExercises, 'POST', {
          category,
          exerciseName: name,
          equipmentType,
        });
      },
    }),
    {
      name: 'history-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.isLoading = false;
        // Dates come back from storage as ISO strings, and records written by
        // older versions of the app may be missing an equipment type.
        state.completedWorkouts = state.completedWorkouts.map(parseCompletedWorkout);
        state.customExercises = Object.fromEntries(
          Object.entries(state.customExercises).map(([category, exercises]) => [
            category,
            exercises.map((exercise) => ({
              name: exercise.name,
              equipmentType: parseEquipmentType(exercise.equipmentType) ?? DEFAULT_EQUIPMENT_TYPE,
            })),
          ]),
        );
      },
    },
  ),
);
