import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

export interface SyncRequest {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body?: any;
}

interface SyncState {
  queue: SyncRequest[];
  isSyncing: boolean;
  enqueueRequest: (url: string, method: 'POST' | 'PUT' | 'DELETE', body?: any) => void;
  processQueue: () => Promise<void>;
  clearQueue: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      queue: [],
      isSyncing: false,

      enqueueRequest: (url, method, body) => {
        const newReq: SyncRequest = {
          id: Math.random().toString(36).substring(2, 9),
          url,
          method,
          body,
        };
        set((state) => ({ queue: [...state.queue, newReq] }));
        
        // Attempt to process queue immediately if we are online
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

        // We copy the queue to process it sequentially
        let currentQueue = [...queue];

        while (currentQueue.length > 0) {
          const req = currentQueue[0];
          try {
            const response = await fetch(req.url, {
              method: req.method,
              headers: {
                'Content-Type': 'application/json',
              },
              body: req.body ? JSON.stringify(req.body) : undefined,
            });

            if (!response.ok) {
              // If it's a 4xx or 5xx error, we might want to log it and remove it, or keep retrying.
              // For simplicity, we'll keep retrying later if it's network related, 
              // but if it's a 400 bad request, retrying won't help. 
              // We'll assume any response means we reached the server and should remove it.
              console.error(`Sync failed for ${req.url} with status ${response.status}`);
            }

            // Successfully processed or failed with a server response, remove from queue
            currentQueue = currentQueue.slice(1);
            set({ queue: currentQueue });
          } catch (error) {
            console.error('Network error while syncing, will retry later:', error);
            // Stop processing if there's a network error
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
    }
  )
);
