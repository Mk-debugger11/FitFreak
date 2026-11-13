import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useHistoryStore } from '../../store/historyStore';
import { endOfDay, endOfWeek, isSameDay, startOfDay, startOfWeek } from '../../utils/date';
import {
  ActivityPeriod,
  MuscleActivityResult,
  computeMuscleActivity,
} from './muscleActivity';

/**
 * Computes memoized muscle activity for either `'daily'` (today) or `'weekly'`
 * (Monday–Sunday) and refreshes the date boundary on focus after midnight.
 */
export const useMuscleActivity = (period: ActivityPeriod): MuscleActivityResult => {
  const completedWorkouts = useHistoryStore((state) => state.completedWorkouts);
  const exercisesCatalog = useHistoryStore((state) => state.exercisesCatalog);
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());

  useFocusEffect(
    useCallback(() => {
      const now = new Date();
      setAnchorDate((prev) => (isSameDay(prev, now) ? prev : now));
    }, []),
  );

  const range = useMemo(
    () =>
      period === 'daily'
        ? { start: startOfDay(anchorDate), end: endOfDay(anchorDate) }
        : { start: startOfWeek(anchorDate), end: endOfWeek(anchorDate) },
    [period, anchorDate],
  );

  return useMemo(
    () => computeMuscleActivity(completedWorkouts, range, period, exercisesCatalog),
    [completedWorkouts, exercisesCatalog, range, period],
  );
};

