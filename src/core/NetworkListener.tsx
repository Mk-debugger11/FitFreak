import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useHistoryStore } from '../store/historyStore';
import { useSyncStore } from '../store/syncStore';

/** Drains the offline write queue and retries initial sync when back online. */
export const NetworkListener: React.FC = () => {
  const processQueue = useSyncStore((state) => state.processQueue);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        processQueue().then(() => {
          const history = useHistoryStore.getState();
          if (history.hasHydrated && !history.hasSyncedFromServer) {
            history.fetchData();
          }
        });
      }
    });

    return unsubscribe;
  }, [processQueue]);

  return null;
};
