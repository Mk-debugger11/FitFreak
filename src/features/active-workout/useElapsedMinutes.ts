import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getElapsedMinutes } from './workoutSessionUtils';

const ELAPSED_POLL_INTERVAL_MS = 15000;

/**
 * Tracks elapsed whole minutes since `startTime`, syncing immediately on changes,
 * when returning to the active foreground state, and every 15 seconds while mounted.
 * Returns `0` when `startTime` is undefined.
 */
export const useElapsedMinutes = (startTime: Date | string | undefined): number => {
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(() =>
    startTime === undefined ? 0 : getElapsedMinutes(startTime),
  );

  const startTimestamp =
    startTime === undefined
      ? undefined
      : startTime instanceof Date
        ? startTime.getTime()
        : new Date(startTime).getTime();

  useEffect(() => {
    if (startTimestamp === undefined || Number.isNaN(startTimestamp)) {
      setElapsedMinutes(0);
      return;
    }

    const startDate = new Date(startTimestamp);
    const syncElapsed = () => setElapsedMinutes(getElapsedMinutes(startDate));

    syncElapsed();
    const intervalId = setInterval(syncElapsed, ELAPSED_POLL_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncElapsed();
      }
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [startTimestamp]);

  return startTime === undefined ? 0 : elapsedMinutes;
};
