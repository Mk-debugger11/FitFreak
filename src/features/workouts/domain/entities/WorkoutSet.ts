import { Entity } from '../../../../shared/types/common';

export interface WorkoutSet extends Entity {
  exerciseId: string;
  weight: number;
  reps: number;
  completed: boolean;
}
