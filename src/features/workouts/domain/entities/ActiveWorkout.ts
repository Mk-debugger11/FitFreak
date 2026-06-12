import { Entity, EquipmentType } from '../../../shared/types/common';
import { WorkoutSet } from './WorkoutSet';

export interface ActiveWorkout extends Entity {
  templateId?: string;
  category?: string;
  equipmentType?: EquipmentType | string;
  name: string;
  startTime: Date;
  endTime?: Date;
  sets: WorkoutSet[];
}
