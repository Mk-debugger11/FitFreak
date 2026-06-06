import { Entity } from '../../../../shared/types/common';
import { WorkoutSet } from './WorkoutSet';

export interface ActiveWorkout extends Entity {
  templateId?: string;
  category?: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  sets: WorkoutSet[];
}
