import { Entity, EquipmentType } from '../../../shared/types/common';
import { ActiveWorkout } from '../../../workouts/domain/entities/ActiveWorkout';

export interface CompletedWorkout extends Entity {
  name: string;
  category?: string;
  equipmentType?: EquipmentType | string;
  startTime: Date;
  endTime: Date;
  totalVolume: number;
  totalSets: number;
  workoutData: ActiveWorkout;
}
