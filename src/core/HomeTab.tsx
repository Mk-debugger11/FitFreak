import React from 'react';
import { ActiveWorkoutScreen } from '../features/active-workout/ActiveWorkoutScreen';
import { WorkoutLogScreen } from '../features/workout-log/WorkoutLogScreen';
import { useActiveWorkoutStore } from '../store/activeWorkoutStore';

/** The Home tab shows the workout in progress, or the day's log if there is none. */
export const HomeTab: React.FC = () => {
  const currentWorkout = useActiveWorkoutStore((state) => state.currentWorkout);

  return currentWorkout ? <ActiveWorkoutScreen /> : <WorkoutLogScreen />;
};
