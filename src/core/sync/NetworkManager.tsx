import React, { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useSyncStore } from './useSyncStore';

export const NetworkManager: React.FC = () => {
  const processQueue = useSyncStore((state) => state.processQueue);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        processQueue();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [processQueue]);

  return null; // This component doesn't render anything
};
