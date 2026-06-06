import { Entity } from '../../../../shared/types/common';

export interface Exercise extends Entity {
  name: string;
  targetMuscleGroup?: string;
  notes?: string;
}
