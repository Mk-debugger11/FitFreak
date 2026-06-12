import { EquipmentType } from '../types/common';

export const formatSetDisplay = (weight: number, reps: number, equipment?: EquipmentType | string): string => {
  if (equipment === 'bodyweight') {
    return weight > 0 ? `+${weight}kg × ${reps}` : `Bodyweight × ${reps}`;
  }
  if (equipment === 'dumbbell') {
    return `${weight}kg/hand × ${reps}`;
  }
  return `${weight}kg × ${reps}`;
};

export const getLocalISODate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
