/**
 * Offline-first write queue.
 *
 * Every mutation is applied to local state immediately and queued here. The
 * queue is persisted, drained sequentially, and retried on reconnect
 * (see `app/NetworkListener.tsx`).
 */
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createId } from '../utils/id';

export type SyncMethod = 'POST' | 'PUT' | 'DELETE';

export interface SyncRequest {
  id: string;
  url: string;
  method: SyncMethod;
  body?: unknown;
}

interface SyncState {
  queue: SyncRequest[];
  isSyncing: boolean;
  enqueueRequest: (url: string, method: SyncMethod, body?: unknown) => void;
  processQueue: () => Promise<void>;
  clearQueue: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      queue: [],
      isSyncing: false,

      enqueueRequest: (url, method, body) => {
        const request: SyncRequest = { id: createId(), url, method, body };
        set((state) => ({ queue: [...state.queue, request] }));

        // Flush straight away when we're online.
        NetInfo.fetch().then((state) => {
          if (state.isConnected) {
            get().processQueue();
          }
        });
      },

      processQueue: async () => {
        const { queue, isSyncing } = get();
        if (queue.length === 0 || isSyncing) return;

        set({ isSyncing: true });

        let pending = [...queue];

        while (pending.length > 0) {
          const request = pending[0];
          try {
            const response = await fetch(request.url, {
              method: request.method,
              headers: { 'Content-Type': 'application/json' },
              body: request.body ? JSON.stringify(request.body) : undefined,
            });

            if (!response.ok) {
              // We reached the server, so retrying won't help (a 400 stays a
              // 400). Log it and drop the request rather than blocking the
              // queue behind it.
              console.error(`Sync failed for ${request.url} with status ${response.status}`);
            }

            pending = pending.slice(1);
            set({ queue: pending });
          } catch (error) {
            // Network error: keep the request and try again on reconnect.
            console.error('Network error while syncing, will retry later:', error);
            break;
          }
        }

        set({ isSyncing: false });
      },

      clearQueue: () => set({ queue: [] }),
    }),
    {
      name: 'sync-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Queue a mutation without subscribing to the store. */
export const enqueueSync = (url: string, method: SyncMethod, body?: unknown): void =>
  useSyncStore.getState().enqueueRequest(url, method, body);
