export interface Entity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export type EquipmentType = 'dumbbell' | 'barbell' | 'machine' | 'cable' | 'bodyweight';

export interface ExerciseMetadata {
  name: string;
  muscleGroup: string;
  equipmentType: EquipmentType;
}
