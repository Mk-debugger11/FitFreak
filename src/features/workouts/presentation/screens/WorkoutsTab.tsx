import React from 'react';
import { useActiveWorkoutStore } from '../state/useActiveWorkoutStore';
import { TemplatesScreen } from '../../../templates/presentation/screens/TemplatesScreen';
import { ActiveWorkoutScreen } from './ActiveWorkoutScreen';

export const WorkoutsTab = () => {
  const { currentWorkout } = useActiveWorkoutStore();

  if (currentWorkout) {
    return <ActiveWorkoutScreen />;
  }

  return <TemplatesScreen />;
};
