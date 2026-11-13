/**
 * Completed workouts, target muscle groups and custom exercises.
 *
 * Reads hit the API and are cached in AsyncStorage so the app opens instantly
 * and works offline; writes update local state first and are queued for sync.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  api,
  endpoints,
  parseCompletedWorkout,
  parseCustomExercise,
  parseExerciseMetadata,
} from '../services/api';
import {
  ActiveWorkout,
  CompletedWorkout,
  CustomExercisesByCategory,
  EquipmentType,
  ExerciseMetadata,
  TargetMuscleGroups,
} from '../types';
import { addDays, endOfDay, startOfDay, toFetchKey } from '../utils/date';
import { resolveExerciseMuscles } from '../utils/exercise';
import { createId } from '../utils/id';
import { enqueueSync, useSyncStore } from './syncStore';

/** How many days of history to pull on a cold start. */
const INITIAL_HISTORY_DAYS = 7;

/** Returns true when `date` falls within the cold-start workout history window. */
export const isDateInInitialWindow = (date: Date): boolean => {
  const windowStart = startOfDay(addDays(new Date(), -INITIAL_HISTORY_DAYS));
  return startOfDay(date).getTime() >= windowStart.getTime();
};

interface HistoryState {
  isLoading: boolean;
  isFetching: boolean;
  hasHydrated: boolean;
  hasFetchedTargetMuscles: boolean;
  hasSyncedFromServer: boolean;
  completedWorkouts: CompletedWorkout[];
  targetMuscleGroups: TargetMuscleGroups;
  customExercises: CustomExercisesByCategory;
  exercisesCatalog: ExerciseMetadata[];
  /** Date keys (local `YYYY-MM-DD`) already fetched, so we don't refetch them. */
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

const haveSameMuscleList = (
  a?: readonly string[],
  b?: readonly string[],
): boolean => {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
};

/** Adds incoming workouts and refreshes server-enriched muscle targets on cached entries. */
const mergeWorkouts = (
  existing: CompletedWorkout[],
  incoming: CompletedWorkout[],
): CompletedWorkout[] => {
  const incomingById = new Map(incoming.map((workout) => [workout.id, workout]));
  const updatedExisting = existing.map((workout) => {
    const serverWorkout = incomingById.get(workout.id);
    if (!serverWorkout) return workout;

    const hasLocalTargets = (workout.primaryMuscles?.length ?? 0) > 0;
    const hasServerTargets = (serverWorkout.primaryMuscles?.length ?? 0) > 0;
    const isSameWorkoutName = workout.name.trim() === serverWorkout.name.trim();

    const serverDataPrimary =
      serverWorkout.workoutData.primaryMuscles ?? serverWorkout.primaryMuscles;
    const serverDataSecondary =
      serverWorkout.workoutData.secondaryMuscles ?? serverWorkout.secondaryMuscles;
    const serverDataStabilizers =
      serverWorkout.workoutData.stabilizerMuscles ?? serverWorkout.stabilizerMuscles;

    const shouldSyncTargets =
      hasServerTargets &&
      (!hasLocalTargets ||
        (isSameWorkoutName &&
          (!haveSameMuscleList(workout.primaryMuscles, serverWorkout.primaryMuscles) ||
            !haveSameMuscleList(workout.secondaryMuscles, serverWorkout.secondaryMuscles) ||
            (serverWorkout.stabilizerMuscles !== undefined &&
              !haveSameMuscleList(workout.stabilizerMuscles, serverWorkout.stabilizerMuscles)))));

    const needsDataBackfill =
      hasServerTargets &&
      isSameWorkoutName &&
      ((workout.workoutData.primaryMuscles?.length ?? 0) === 0 ||
        (workout.workoutData.stabilizerMuscles === undefined &&
          serverDataStabilizers !== undefined) ||
        shouldSyncTargets);

    if (!shouldSyncTargets && !needsDataBackfill) return workout;

    return {
      ...workout,
      ...(shouldSyncTargets
        ? {
            primaryMuscles: serverWorkout.primaryMuscles,
            secondaryMuscles: serverWorkout.secondaryMuscles,
            stabilizerMuscles: serverWorkout.stabilizerMuscles,
          }
        : {}),
      workoutData: {
        ...workout.workoutData,
        ...(needsDataBackfill
          ? {
              primaryMuscles: serverDataPrimary,
              secondaryMuscles: serverDataSecondary,
              ...(serverDataStabilizers !== undefined
                ? { stabilizerMuscles: serverDataStabilizers }
                : {}),
            }
          : {}),
      },
    };
  });
  const knownIds = new Set(existing.map((workout) => workout.id));
  const added = incoming.filter((workout) => !knownIds.has(workout.id));
  return [...updatedExisting, ...added].sort(byNewestFirst);
};

const hasCachedData = (
  state: Pick<HistoryState, 'completedWorkouts' | 'targetMuscleGroups' | 'customExercises' | 'fetchedDates'>,
): boolean =>
  state.completedWorkouts.length > 0 ||
  Object.keys(state.targetMuscleGroups).length > 0 ||
  Object.keys(state.customExercises).length > 0 ||
  Object.keys(state.fetchedDates).length > 0;

const inFlightDateFetches = new Map<string, Promise<void>>();

const waitForSyncHydration = (): Promise<void> => {
  if (useSyncStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useSyncStore.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
};

const mergeTargetMuscles = (
  local: TargetMuscleGroups,
  remote: TargetMuscleGroups,
): TargetMuscleGroups => {
  const pendingDates = new Set<string>();
  for (const req of useSyncStore.getState().queue) {
    if (req.url === endpoints.targetMuscles) {
      const dateString = (req.body as { dateString?: string } | undefined)?.dateString;
      if (dateString) pendingDates.add(dateString);
    }
  }
  if (pendingDates.size === 0) return remote;

  const merged: TargetMuscleGroups = { ...remote };
  for (const dateKey of pendingDates) {
    merged[dateKey] = local[dateKey] ?? [];
  }
  return merged;
};

/** Persisted Zustand store for completed workouts, daily targets, and exercise catalogs. */
export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      isLoading: true,
      isFetching: false,
      hasHydrated: false,
      hasFetchedTargetMuscles: false,
      hasSyncedFromServer: false,
      completedWorkouts: [],
      targetMuscleGroups: {},
      customExercises: {},
      exercisesCatalog: [],
      fetchedDates: {},

      fetchData: async () => {
        if (get().isFetching) return;

        try {
          const today = startOfDay(new Date());
          set((state) => ({
            isFetching: true,
            // Only keep the full-screen blocker when nothing cached exists.
            isLoading: hasCachedData(state) ? false : state.isLoading,
          }));

          await waitForSyncHydration();
          await useSyncStore.getState().processQueue();

          const [workoutsResult, targetMusclesResult, customExercisesResult, exercisesResult] =
            await Promise.allSettled([
              api.getWorkouts({ startDate: addDays(today, -INITIAL_HISTORY_DAYS) }),
              api.getTargetMuscles(),
              api.getCustomExercises(),
              api.getExercises(),
            ]);

          if (workoutsResult.status === 'rejected') {
            console.error('Failed to fetch workouts from MongoDB', workoutsResult.reason);
          }
          if (targetMusclesResult.status === 'rejected') {
            console.error('Failed to fetch target muscles from MongoDB', targetMusclesResult.reason);
          }
          if (customExercisesResult.status === 'rejected') {
            console.error('Failed to fetch custom exercises from MongoDB', customExercisesResult.reason);
          }
          if (exercisesResult.status === 'rejected') {
            console.warn('Failed to fetch exercise catalog from MongoDB', exercisesResult.reason);
          }

          const fetchedDates: Record<string, boolean> = {};
          if (workoutsResult.status === 'fulfilled') {
            for (let dayOffset = 0; dayOffset <= INITIAL_HISTORY_DAYS; dayOffset += 1) {
              fetchedDates[toFetchKey(addDays(today, -dayOffset))] = true;
            }
          }

          set((state) => ({
            completedWorkouts:
              workoutsResult.status === 'fulfilled'
                ? mergeWorkouts(state.completedWorkouts, workoutsResult.value)
                : state.completedWorkouts,
            targetMuscleGroups:
              targetMusclesResult.status === 'fulfilled'
                ? mergeTargetMuscles(state.targetMuscleGroups, targetMusclesResult.value)
                : state.targetMuscleGroups,
            customExercises:
              customExercisesResult.status === 'fulfilled'
                ? { ...state.customExercises, ...customExercisesResult.value }
                : state.customExercises,
            exercisesCatalog:
              exercisesResult.status === 'fulfilled' && exercisesResult.value !== null
                ? exercisesResult.value
                : state.exercisesCatalog,
            fetchedDates: { ...state.fetchedDates, ...fetchedDates },
            hasFetchedTargetMuscles:
              state.hasFetchedTargetMuscles || targetMusclesResult.status === 'fulfilled',
            hasSyncedFromServer:
              workoutsResult.status === 'fulfilled' &&
              targetMusclesResult.status === 'fulfilled' &&
              customExercisesResult.status === 'fulfilled',
            isLoading: false,
            isFetching: false,
          }));
        } catch (error) {
          console.error('Failed to fetch data from MongoDB', error);
          set({ isLoading: false, isFetching: false });
        }
      },

      fetchWorkoutsForDate: async (date) => {
        const dateKey = toFetchKey(date);
        const needTargetMuscles = !get().hasFetchedTargetMuscles;
        if (get().fetchedDates[dateKey] && !needTargetMuscles) return;

        const existingRequest = inFlightDateFetches.get(dateKey);
        if (existingRequest) return existingRequest;

        const request = (async () => {
          try {
            const [workoutsResult, targetMusclesResult] = await Promise.allSettled([
              get().fetchedDates[dateKey]
                ? Promise.resolve(null)
                : api.getWorkouts({
                    startDate: startOfDay(date),
                    endDate: endOfDay(date),
                  }),
              needTargetMuscles ? api.getTargetMuscles() : Promise.resolve(null),
            ]);

            if (workoutsResult.status === 'rejected') {
              console.error('Failed to fetch workouts for date', workoutsResult.reason);
            }
            if (targetMusclesResult.status === 'rejected') {
              console.error('Failed to fetch target muscles for date', targetMusclesResult.reason);
            }

            const workouts = workoutsResult.status === 'fulfilled' ? workoutsResult.value : null;
            const targetMuscles =
              targetMusclesResult.status === 'fulfilled' ? targetMusclesResult.value : null;

            set((state) => ({
              completedWorkouts: workouts
                ? mergeWorkouts(state.completedWorkouts, workouts)
                : state.completedWorkouts,
              targetMuscleGroups: targetMuscles
                ? mergeTargetMuscles(state.targetMuscleGroups, targetMuscles)
                : state.targetMuscleGroups,
              hasFetchedTargetMuscles: state.hasFetchedTargetMuscles || targetMuscles !== null,
              fetchedDates: workouts ? { ...state.fetchedDates, [dateKey]: true } : state.fetchedDates,
            }));
          } catch (error) {
            console.error('Failed to fetch workouts for date', error);
          } finally {
            inFlightDateFetches.delete(dateKey);
          }
        })();

        inFlightDateFetches.set(dateKey, request);
        return request;
      },

      addCompletedWorkout: (workout) => {
        const completedSets = workout.sets.filter((set) => set.completed);
        const workingSets = completedSets.filter((set) => set.isWarmup !== true);
        const targets = resolveExerciseMuscles(
          workout.name,
          workout.category,
          {
            primaryMuscles: workout.primaryMuscles,
            secondaryMuscles: workout.secondaryMuscles,
            stabilizerMuscles: workout.stabilizerMuscles,
          },
          get().exercisesCatalog,
        );
        const targetFields = targets
          ? {
              primaryMuscles: targets.primary,
              secondaryMuscles: targets.secondary,
              stabilizerMuscles: targets.stabilizers,
            }
          : {};
        const enrichedWorkout: ActiveWorkout = {
          ...workout,
          ...targetFields,
        };

        const completedWorkout: CompletedWorkout = {
          id: createId(),
          name: workout.name,
          category: workout.category,
          equipmentType: workout.equipmentType,
          ...targetFields,
          startTime: workout.startTime,
          endTime: workout.endTime ?? new Date(),
          totalVolume: workingSets.reduce((total, set) => total + set.weight * set.reps, 0),
          totalSets: workingSets.length,
          workoutData: enrichedWorkout,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set((state) => ({
          completedWorkouts: [completedWorkout, ...state.completedWorkouts],
        }));

        enqueueSync(endpoints.workouts, 'POST', completedWorkout);
      },

      updateCompletedWorkoutName: (id, name) => {
        const catalog = get().exercisesCatalog;
        set((state) => ({
          completedWorkouts: state.completedWorkouts.map((workout) => {
            if (workout.id !== id) return workout;
            const targets = resolveExerciseMuscles(name, workout.category, undefined, catalog);
            const targetFields = targets
              ? {
                  primaryMuscles: targets.primary,
                  secondaryMuscles: targets.secondary,
                  stabilizerMuscles: targets.stabilizers,
                }
              : {
                  primaryMuscles: undefined,
                  secondaryMuscles: undefined,
                  stabilizerMuscles: undefined,
                };
            return {
              ...workout,
              name,
              ...targetFields,
              workoutData: {
                ...workout.workoutData,
                name,
                ...targetFields,
                updatedAt: new Date(),
              },
              updatedAt: new Date(),
            };
          }),
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

        const targets = resolveExerciseMuscles(name, category, undefined, get().exercisesCatalog);
        const targetFields = targets
          ? {
              primaryMuscles: targets.primary,
              secondaryMuscles: targets.secondary,
              stabilizerMuscles: targets.stabilizers,
            }
          : {};

        set((state) => ({
          customExercises: {
            ...state.customExercises,
            [category]: [...current, { name, equipmentType, ...targetFields }],
          },
        }));

        enqueueSync(endpoints.customExercises, 'POST', {
          category,
          exerciseName: name,
          equipmentType,
          ...targetFields,
        });
      },
    }),
    {
      name: 'history-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        completedWorkouts: state.completedWorkouts,
        targetMuscleGroups: state.targetMuscleGroups,
        customExercises: state.customExercises,
        exercisesCatalog: state.exercisesCatalog,
        fetchedDates: state.fetchedDates,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<HistoryState> | undefined) ?? {};
        // Dates come back from storage as ISO strings, and records written by
        // older versions of the app may be missing an equipment type or muscle targets.
        const completedWorkouts = Array.isArray(persisted.completedWorkouts)
          ? persisted.completedWorkouts.map(parseCompletedWorkout)
          : currentState.completedWorkouts;
        const targetMuscleGroups =
          persisted.targetMuscleGroups && typeof persisted.targetMuscleGroups === 'object'
            ? persisted.targetMuscleGroups
            : currentState.targetMuscleGroups;
        const customExercises =
          persisted.customExercises && typeof persisted.customExercises === 'object'
            ? Object.fromEntries(
                Object.entries(persisted.customExercises).map(([category, exercises]) => [
                  category,
                  Array.isArray(exercises)
                    ? exercises
                        .map(parseCustomExercise)
                        .filter((exercise) => exercise.name.length > 0)
                    : [],
                ]),
              )
            : currentState.customExercises;
        const exercisesCatalog = Array.isArray(persisted.exercisesCatalog)
          ? persisted.exercisesCatalog
              .map(parseExerciseMetadata)
              .filter((exercise): exercise is ExerciseMetadata => exercise !== null)
          : currentState.exercisesCatalog;
        const fetchedDates =
          persisted.fetchedDates && typeof persisted.fetchedDates === 'object'
            ? persisted.fetchedDates
            : currentState.fetchedDates;

        const merged: HistoryState = {
          ...currentState,
          completedWorkouts,
          targetMuscleGroups,
          customExercises,
          exercisesCatalog,
          fetchedDates,
          hasHydrated: true,
        };

        merged.isLoading = !hasCachedData(merged);
        return merged;
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error('Failed to hydrate history store:', error);
          useHistoryStore.setState({ hasHydrated: true });
          useHistoryStore.getState().fetchData();
        }
      },
    },
  ),
);
