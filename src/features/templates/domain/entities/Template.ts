import { Entity } from '../../../../shared/types/common';
import { Exercise } from './Exercise';

export interface TemplateExercise {
  id: string;
  exercise: Exercise;
  sets: number;
  reps: number;
  weight?: number; // Optional baseline weight
}

export interface Template extends Entity {
  name: string;
  description?: string;
  exercises: TemplateExercise[];
}
