/**
 * User metabolic & nutritional profile store.
 *
 * Persisted locally with offline-first synchronization to `/api/profile`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { api, endpoints, parseUserProfile } from '../services/api';
import { UserProfile } from '../types';
import { createId } from '../utils/id';
import { enqueueSync, useSyncStore } from './syncStore';
import { computeMaintenanceCalories } from '../features/nutrition/energyFormulas';

export interface ProfileState {
  profile: UserProfile | null;
  hasHydrated: boolean;
  isFetching: boolean;
  fetchProfile: () => Promise<void>;
  saveProfile: (patch: Partial<UserProfile>) => Promise<void>;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: null,
      hasHydrated: false,
      isFetching: false,

      fetchProfile: async () => {
        if (get().isFetching) return;
        set({ isFetching: true });
        try {
          const serverProfile = await api.getProfile();
          const hasPendingProfileSync = useSyncStore
            .getState()
            .queue.some((req) => req.url === endpoints.profile);
          if (!hasPendingProfileSync && serverProfile) {
            set({ profile: serverProfile });
          }
        } catch (err) {
          console.error('Failed to fetch profile:', err);
        } finally {
          set({ isFetching: false });
        }
      },

      saveProfile: async (patch: Partial<UserProfile>) => {
        const current = get().profile;
        const now = new Date();
        const updatedProfile: UserProfile = current
          ? {
              ...current,
              ...patch,
              updatedAt: now,
            }
          : {
              id: patch.id || createId(),
              sex: patch.sex ?? 'male',
              heightCm: patch.heightCm ?? 175,
              weightKg: patch.weightKg ?? 70,
              birthDate: patch.birthDate ?? new Date('1995-01-01'),
              activityLevel: patch.activityLevel ?? 'moderate',
              goal: patch.goal ?? 'maintain',
              ...patch,
              createdAt: patch.createdAt ?? now,
              updatedAt: now,
            };

        set({ profile: updatedProfile });
        enqueueSync(endpoints.profile, 'PUT', updatedProfile);
      },
    }),
    {
      name: 'profile-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        profile: state.profile,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<ProfileState> | undefined) ?? {};
        const profile = persisted.profile ? parseUserProfile(persisted.profile) : currentState.profile;
        return {
          ...currentState,
          profile,
          hasHydrated: true,
        };
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error('Failed to hydrate profile store:', error);
        }
        useProfileStore.setState({ hasHydrated: true });
      },
    },
  ),
);

/**
 * Non-hook helper returning current maintenance calories (TDEE) or null if profile incomplete.
 */
export const getMaintenanceCalories = (): number | null => {
  const profile = useProfileStore.getState().profile;
  return computeMaintenanceCalories(profile)?.kcal ?? null;
};
