import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useSyncStore } from '../store/syncStore';

/** Drains the offline write queue whenever the device comes back online. */
export const NetworkListener: React.FC = () => {
  const processQueue = useSyncStore((state) => state.processQueue);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        processQueue();
      }
    });

    return unsubscribe;
  }, [processQueue]);

  return null;
};
