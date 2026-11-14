/**
 * Nutrition, food catalogs, custom foods, and meal logs store.
 *
 * Persisted locally with offline-first synchronization to `/api/nutrition-entries`
 * and `/api/custom-foods`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  api,
  endpoints,
  parseCustomFood,
  parseFoodItem,
  parseLoggedFood,
} from '../services/api';
import {
  CustomFood,
  FoodItem,
  LoggedFood,
  MacroNutrients,
  MealType,
} from '../types';
import { ALL_BUILTIN_FOODS } from '../constants/foods';
import { addDays, toLocalDateKey } from '../utils/date';
import { findFoodInCatalog, normalizeFoodName } from '../utils/food';
import { createId } from '../utils/id';
import { enqueueSync, useSyncStore } from './syncStore';
import { scaleMacros } from '../features/nutrition/servingMath';

const INITIAL_HISTORY_DAYS = 7;

export interface NutritionState {
  isLoading: boolean;
  isFetching: boolean;
  hasHydrated: boolean;
  loggedFoods: LoggedFood[];
  foodsCatalog: FoodItem[];
  customFoods: CustomFood[];
  fetchedNutritionDates: Record<string, boolean>;

  fetchNutritionData: () => Promise<void>;
  fetchEntriesForDate: (dateString: string) => Promise<void>;
  logFood: (input: {
    dateString: string;
    mealType: MealType;
    food: FoodItem | CustomFood;
    quantity: number;
    servingLabel?: string;
    foodId?: string;
  }) => LoggedFood;
  updateLoggedFood: (
    id: string,
    patch: {
      quantity?: number;
      servingLabel?: string;
      mealType?: MealType;
      macros?: MacroNutrients;
    },
  ) => void;
  deleteLoggedFood: (id: string) => void;
  addCustomFood: (food: Omit<CustomFood, 'id'>) => CustomFood | null;
  deleteCustomFood: (id: string) => void;
  searchFoods: (query: string) => (FoodItem | CustomFood)[];
  recentFoods: (limit?: number) => (FoodItem | CustomFood)[];
}

const waitForSyncHydration = (): Promise<void> => {
  if (useSyncStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useSyncStore.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
};

const hasCachedNutritionData = (
  state: Pick<NutritionState, 'loggedFoods' | 'customFoods' | 'fetchedNutritionDates'>,
): boolean =>
  state.loggedFoods.length > 0 ||
  state.customFoods.length > 0 ||
  Object.keys(state.fetchedNutritionDates).length > 0;

const mergeLoggedFoods = (
  existing: LoggedFood[],
  incoming: LoggedFood[],
): LoggedFood[] => {
  const incomingById = new Map(incoming.map((item) => [item.id, item]));

  const pendingEntryIds = new Set<string>();
  for (const req of useSyncStore.getState().queue) {
    if (req.url.startsWith(endpoints.nutritionEntries)) {
      const bodyId = (req.body as { id?: string } | undefined)?.id;
      if (bodyId) pendingEntryIds.add(bodyId);
      const urlParts = req.url.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      if (lastPart && lastPart !== 'nutrition-entries') {
        pendingEntryIds.add(lastPart);
      }
    }
  }

  const updatedExisting = existing.map((item) => {
    if (pendingEntryIds.has(item.id)) return item;
    return incomingById.get(item.id) ?? item;
  });

  const knownIds = new Set(existing.map((item) => item.id));
  const newItems = incoming.filter((item) => !knownIds.has(item.id));

  return [...updatedExisting, ...newItems].sort(
    (a, b) => b.loggedAt.getTime() - a.loggedAt.getTime(),
  );
};

const mergeCustomFoods = (
  local: CustomFood[],
  server: CustomFood[],
): CustomFood[] => {
  const pendingFoodIds = new Set<string>();
  for (const req of useSyncStore.getState().queue) {
    if (req.url.startsWith(endpoints.customFoods)) {
      const bodyId = (req.body as { id?: string } | undefined)?.id;
      if (bodyId) pendingFoodIds.add(bodyId);
      const urlParts = req.url.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      if (lastPart && lastPart !== 'custom-foods') {
        pendingFoodIds.add(lastPart);
      }
    }
  }

  const serverIds = new Set(server.map((f) => f.id));
  const pendingLocal = local.filter((f) => pendingFoodIds.has(f.id) || !serverIds.has(f.id));
  return [...server, ...pendingLocal];
};

const inFlightDateFetches = new Map<string, Promise<void>>();

export const useNutritionStore = create<NutritionState>()(
  persist(
    (set, get) => ({
      isLoading: true,
      isFetching: false,
      hasHydrated: false,
      loggedFoods: [],
      foodsCatalog: ALL_BUILTIN_FOODS as FoodItem[],
      customFoods: [],
      fetchedNutritionDates: {},

      fetchNutritionData: async () => {
        if (get().isFetching) return;

        try {
          set((state) => ({
            isFetching: true,
            isLoading: hasCachedNutritionData(state) ? false : state.isLoading,
          }));

          await waitForSyncHydration();
          await useSyncStore.getState().processQueue();

          const today = new Date();
          const endDate = toLocalDateKey(today);
          const startDate = toLocalDateKey(addDays(today, -INITIAL_HISTORY_DAYS));

          const [entriesResult, foodsResult, customFoodsResult] = await Promise.allSettled([
            api.getNutritionEntries({ startDate, endDate }),
            api.getFoods(),
            api.getCustomFoods(),
          ]);

          if (entriesResult.status === 'rejected') {
            console.error('Failed to fetch nutrition entries:', entriesResult.reason);
          }
          if (foodsResult.status === 'rejected') {
            console.warn('Failed to fetch food catalog:', foodsResult.reason);
          }
          if (customFoodsResult.status === 'rejected') {
            console.error('Failed to fetch custom foods:', customFoodsResult.reason);
          }

          const fetchedDates: Record<string, boolean> = {};
          if (entriesResult.status === 'fulfilled') {
            for (let dayOffset = 0; dayOffset <= INITIAL_HISTORY_DAYS; dayOffset += 1) {
              fetchedDates[toLocalDateKey(addDays(today, -dayOffset))] = true;
            }
          }

          set((state) => {
            const mergedFoodsCatalog =
              foodsResult.status === 'fulfilled'
                ? foodsResult.value === null
                  ? (ALL_BUILTIN_FOODS as FoodItem[])
                  : foodsResult.value.length > 0
                    ? foodsResult.value
                    : (ALL_BUILTIN_FOODS as FoodItem[])
                : state.foodsCatalog;

            return {
              loggedFoods:
                entriesResult.status === 'fulfilled'
                  ? mergeLoggedFoods(state.loggedFoods, entriesResult.value)
                  : state.loggedFoods,
              foodsCatalog: mergedFoodsCatalog,
              customFoods:
                customFoodsResult.status === 'fulfilled'
                  ? mergeCustomFoods(state.customFoods, customFoodsResult.value)
                  : state.customFoods,
              fetchedNutritionDates: {
                ...state.fetchedNutritionDates,
                ...fetchedDates,
              },
            };
          });
        } catch (err) {
          console.error('Failed to fetch nutrition data:', err);
        } finally {
          set({ isFetching: false, isLoading: false });
        }
      },

      fetchEntriesForDate: async (dateString: string) => {
        if (get().fetchedNutritionDates[dateString]) return;
        const existingPromise = inFlightDateFetches.get(dateString);
        if (existingPromise) return existingPromise;

        const promise = (async () => {
          try {
            const incoming = await api.getNutritionEntries({
              startDate: dateString,
              endDate: dateString,
            });
            set((state) => ({
              loggedFoods: mergeLoggedFoods(state.loggedFoods, incoming),
              fetchedNutritionDates: {
                ...state.fetchedNutritionDates,
                [dateString]: true,
              },
            }));
          } catch (err) {
            console.error(`Failed to fetch nutrition entries for date ${dateString}:`, err);
          } finally {
            inFlightDateFetches.delete(dateString);
          }
        })();

        inFlightDateFetches.set(dateString, promise);
        return promise;
      },

      logFood: (input) => {
        const now = new Date();
        const macros = scaleMacros(input.food, input.quantity);
        const foodId =
          input.foodId ??
          ('id' in input.food && typeof input.food.id === 'string' ? input.food.id : undefined);

        const entry: LoggedFood = {
          id: createId(),
          dateString: input.dateString,
          mealType: input.mealType,
          foodName: input.food.name,
          basis: input.food.basis,
          quantity: input.quantity,
          ...(input.servingLabel ? { servingLabel: input.servingLabel } : {}),
          macros,
          ...(foodId ? { foodId } : {}),
          loggedAt: now,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          loggedFoods: [entry, ...state.loggedFoods],
          fetchedNutritionDates: {
            ...state.fetchedNutritionDates,
            [input.dateString]: true,
          },
        }));

        enqueueSync(endpoints.nutritionEntries, 'POST', entry);
        return entry;
      },

      updateLoggedFood: (id, patch) => {
        let updatedEntry: LoggedFood | null = null;
        set((state) => {
          const next = state.loggedFoods.map((item) => {
            if (item.id !== id) return item;
            updatedEntry = {
              ...item,
              ...patch,
              updatedAt: new Date(),
            };
            return updatedEntry;
          });
          return { loggedFoods: next };
        });

        if (updatedEntry) {
          enqueueSync(endpoints.nutritionEntry(id), 'PUT', updatedEntry);
        }
      },

      deleteLoggedFood: (id) => {
        set((state) => ({
          loggedFoods: state.loggedFoods.filter((item) => item.id !== id),
        }));
        enqueueSync(endpoints.nutritionEntry(id), 'DELETE');
      },

      addCustomFood: (food) => {
        const normalized = normalizeFoodName(food.name);
        if (!normalized) return null;

        const existing = get().customFoods;
        const isDuplicate = existing.some(
          (item) => normalizeFoodName(item.name) === normalized,
        );
        if (isDuplicate) {
          return null;
        }

        const newFood: CustomFood = {
          ...food,
          id: createId(),
        };

        set((state) => ({
          customFoods: [...state.customFoods, newFood],
        }));

        enqueueSync(endpoints.customFoods, 'POST', newFood);
        return newFood;
      },

      deleteCustomFood: (id) => {
        set((state) => ({
          customFoods: state.customFoods.filter((item) => item.id !== id),
        }));
        enqueueSync(endpoints.customFood(id), 'DELETE');
      },

      searchFoods: (query) => {
        const q = query.trim().toLowerCase();
        if (!q) return [];

        const { customFoods, foodsCatalog } = get();
        const catalog = foodsCatalog.length > 0 ? foodsCatalog : (ALL_BUILTIN_FOODS as FoodItem[]);
        const allFoods: (FoodItem | CustomFood)[] = [...customFoods, ...catalog];
        const normQ = normalizeFoodName(query);

        const prefixMatches: (FoodItem | CustomFood)[] = [];
        const otherMatches: (FoodItem | CustomFood)[] = [];

        for (const item of allFoods) {
          const nameLower = item.name.toLowerCase();
          const normName = normalizeFoodName(item.name);

          const nameStarts =
            nameLower.startsWith(q) || (normQ.length > 0 && normName.startsWith(normQ));
          const aliasStarts =
            item.aliases?.some(
              (a) =>
                a.toLowerCase().startsWith(q) ||
                (normQ.length > 0 && normalizeFoodName(a).startsWith(normQ)),
            ) ?? false;

          if (nameStarts || aliasStarts) {
            prefixMatches.push(item);
          } else {
            const nameIncludes =
              nameLower.includes(q) || (normQ.length > 0 && normName.includes(normQ));
            const aliasIncludes =
              item.aliases?.some(
                (a) =>
                  a.toLowerCase().includes(q) ||
                  (normQ.length > 0 && normalizeFoodName(a).includes(normQ)),
              ) ?? false;
            if (nameIncludes || aliasIncludes) {
              otherMatches.push(item);
            }
          }
        }

        return [...prefixMatches, ...otherMatches].slice(0, 50);
      },

      recentFoods: (limit = 8) => {
        const { loggedFoods, customFoods, foodsCatalog } = get();
        const catalog = foodsCatalog.length > 0 ? foodsCatalog : (ALL_BUILTIN_FOODS as FoodItem[]);

        const sorted = [...loggedFoods].sort(
          (a, b) => b.loggedAt.getTime() - a.loggedAt.getTime(),
        );

        const seenNames = new Set<string>();
        const results: (FoodItem | CustomFood)[] = [];

        for (const entry of sorted) {
          const normName = normalizeFoodName(entry.foodName);
          if (!normName || seenNames.has(normName)) continue;
          seenNames.add(normName);

          let found: FoodItem | CustomFood | undefined;
          if (entry.foodId) {
            found = customFoods.find((f) => f.id === entry.foodId);
          }
          if (!found) {
            found = customFoods.find((f) => normalizeFoodName(f.name) === normName);
          }
          if (!found) {
            found = findFoodInCatalog(catalog, entry.foodName);
          }

          if (found) {
            results.push(found);
            if (results.length >= limit) break;
          }
        }

        return results;
      },
    }),
    {
      name: 'nutrition-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        loggedFoods: state.loggedFoods,
        foodsCatalog: state.foodsCatalog,
        customFoods: state.customFoods,
        fetchedNutritionDates: state.fetchedNutritionDates,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<NutritionState> | undefined) ?? {};
        const loggedFoods = Array.isArray(persisted.loggedFoods)
          ? persisted.loggedFoods
              .map(parseLoggedFood)
              .filter((item): item is LoggedFood => item !== null)
          : currentState.loggedFoods;
        const foodsCatalog =
          Array.isArray(persisted.foodsCatalog) && persisted.foodsCatalog.length > 0
            ? persisted.foodsCatalog
                .map(parseFoodItem)
                .filter((item): item is FoodItem => item !== null)
            : currentState.foodsCatalog;
        const customFoods = Array.isArray(persisted.customFoods)
          ? persisted.customFoods
              .map(parseCustomFood)
              .filter((item): item is CustomFood => item !== null)
          : currentState.customFoods;
        const fetchedNutritionDates =
          persisted.fetchedNutritionDates && typeof persisted.fetchedNutritionDates === 'object'
            ? persisted.fetchedNutritionDates
            : currentState.fetchedNutritionDates;

        const merged: NutritionState = {
          ...currentState,
          loggedFoods,
          foodsCatalog: foodsCatalog.length > 0 ? foodsCatalog : (ALL_BUILTIN_FOODS as FoodItem[]),
          customFoods,
          fetchedNutritionDates,
          hasHydrated: true,
          isLoading: !hasCachedNutritionData({
            loggedFoods,
            customFoods,
            fetchedNutritionDates,
          }),
        };
        return merged;
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error('Failed to hydrate nutrition store:', error);
          useNutritionStore.setState({ hasHydrated: true, isLoading: false });
        }
      },
    },
  ),
);
