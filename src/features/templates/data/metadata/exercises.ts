import { ExerciseMetadata } from '../../../../shared/types/common';

export const DEFAULT_MUSCLE_EXERCISES: Record<string, ExerciseMetadata[]> = {
  Chest: [
    { name: 'Incline Dumbbell Press', muscleGroup: 'Chest', equipmentType: 'dumbbell' },
    { name: 'Flat Dumbbell Press', muscleGroup: 'Chest', equipmentType: 'dumbbell' },
    { name: 'Barbell Bench Press', muscleGroup: 'Chest', equipmentType: 'barbell' },
    { name: 'Pec Deck Fly', muscleGroup: 'Chest', equipmentType: 'machine' },
    { name: 'Cable Fly', muscleGroup: 'Chest', equipmentType: 'cable' },
  ],
  Back: [
    { name: 'Lat Pulldown', muscleGroup: 'Back', equipmentType: 'cable' },
    { name: 'Pull-ups', muscleGroup: 'Back', equipmentType: 'bodyweight' },
    { name: 'Seated Cable Row', muscleGroup: 'Back', equipmentType: 'cable' },
    { name: 'One-arm Dumbbell Row', muscleGroup: 'Back', equipmentType: 'dumbbell' },
    { name: 'T-Bar Row', muscleGroup: 'Back', equipmentType: 'barbell' },
    { name: 'Deadlift', muscleGroup: 'Back', equipmentType: 'barbell' },
  ],
  Shoulders: [
    { name: 'Dumbbell Shoulder Press', muscleGroup: 'Shoulders', equipmentType: 'dumbbell' },
    { name: 'Lateral Raise', muscleGroup: 'Shoulders', equipmentType: 'dumbbell' },
    { name: 'Rear Delt Fly', muscleGroup: 'Shoulders', equipmentType: 'machine' },
    { name: 'Upright Row', muscleGroup: 'Shoulders', equipmentType: 'barbell' },
    { name: 'Shrugs', muscleGroup: 'Shoulders', equipmentType: 'dumbbell' },
    { name: "Farmer's Walk", muscleGroup: 'Shoulders', equipmentType: 'dumbbell' },
  ],
  Biceps: [
    { name: 'Dumbbell Curl', muscleGroup: 'Biceps', equipmentType: 'dumbbell' },
    { name: 'Incline Dumbbell Curl', muscleGroup: 'Biceps', equipmentType: 'dumbbell' },
    { name: 'Preacher Curl', muscleGroup: 'Biceps', equipmentType: 'barbell' },
    { name: 'Barbell Curl', muscleGroup: 'Biceps', equipmentType: 'barbell' },
    { name: 'Hammer Curl', muscleGroup: 'Biceps', equipmentType: 'dumbbell' },
  ],
  Triceps: [
    { name: 'Tricep Pushdown', muscleGroup: 'Triceps', equipmentType: 'cable' },
    { name: 'Overhead Cable Extension', muscleGroup: 'Triceps', equipmentType: 'cable' },
    { name: 'Overhead Dumbbell Extension', muscleGroup: 'Triceps', equipmentType: 'dumbbell' },
    { name: 'Dips', muscleGroup: 'Triceps', equipmentType: 'bodyweight' },
    { name: 'Close-Grip Bench Press', muscleGroup: 'Triceps', equipmentType: 'barbell' },
  ],
  Forearms: [
    { name: 'Wrist Curl', muscleGroup: 'Forearms', equipmentType: 'barbell' },
    { name: 'Reverse Wrist Curl', muscleGroup: 'Forearms', equipmentType: 'barbell' },
    { name: 'Reverse Cable Curl', muscleGroup: 'Forearms', equipmentType: 'cable' },
  ],
  Legs: [
    { name: 'Squat', muscleGroup: 'Legs', equipmentType: 'barbell' },
    { name: 'Leg Press', muscleGroup: 'Legs', equipmentType: 'machine' },
    { name: 'Romanian Deadlift', muscleGroup: 'Legs', equipmentType: 'barbell' },
    { name: 'Leg Curl', muscleGroup: 'Legs', equipmentType: 'machine' },
    { name: 'Leg Extension', muscleGroup: 'Legs', equipmentType: 'machine' },
    { name: 'Bulgarian Split Squat', muscleGroup: 'Legs', equipmentType: 'dumbbell' },
    { name: 'Lunges', muscleGroup: 'Legs', equipmentType: 'dumbbell' },
    { name: 'Calf Raise', muscleGroup: 'Legs', equipmentType: 'machine' },
  ],
  'Abs/Core': [
    { name: 'Cable Crunch', muscleGroup: 'Abs/Core', equipmentType: 'cable' },
    { name: 'Hanging Leg Raise', muscleGroup: 'Abs/Core', equipmentType: 'bodyweight' },
    { name: 'Reverse Crunch', muscleGroup: 'Abs/Core', equipmentType: 'bodyweight' },
    { name: 'Plank', muscleGroup: 'Abs/Core', equipmentType: 'bodyweight' },
    { name: 'Russian Twist', muscleGroup: 'Abs/Core', equipmentType: 'bodyweight' },
  ],
  Neck: [
    { name: 'Neck Flexion', muscleGroup: 'Neck', equipmentType: 'machine' },
    { name: 'Neck Extension', muscleGroup: 'Neck', equipmentType: 'machine' },
    { name: 'Neck Harness Work', muscleGroup: 'Neck', equipmentType: 'cable' },
  ],
};
