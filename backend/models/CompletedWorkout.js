const mongoose = require('mongoose');
const { EQUIPMENT_TYPES, MUSCLE_IDS } = require('../constants/muscles');

const workoutSetSchema = new mongoose.Schema({
  id: { type: String, required: true },
  exerciseId: { type: String, required: true },
  weight: { type: Number, required: true },
  reps: { type: Number, required: true },
  completed: { type: Boolean, required: true },
  isWarmup: { type: Boolean, default: undefined },
  rir: { type: Number, min: 0, max: 10, default: undefined },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
});

const activeWorkoutSchema = new mongoose.Schema({
  id: { type: String, required: true },
  templateId: { type: String },
  category: { type: String },
  name: { type: String, required: true },
  equipmentType: { type: String, enum: EQUIPMENT_TYPES },
  primaryMuscles: { type: [String], enum: MUSCLE_IDS, default: undefined },
  secondaryMuscles: { type: [String], enum: MUSCLE_IDS, default: undefined },
  stabilizerMuscles: { type: [String], enum: MUSCLE_IDS, default: undefined },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  sets: [workoutSetSchema],
  createdAt: { type: Date },
  updatedAt: { type: Date },
});

const completedWorkoutSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, default: 'default_user' },
  name: { type: String, required: true },
  category: { type: String },
  equipmentType: { type: String, enum: EQUIPMENT_TYPES },
  primaryMuscles: { type: [String], enum: MUSCLE_IDS, default: undefined },
  secondaryMuscles: { type: [String], enum: MUSCLE_IDS, default: undefined },
  stabilizerMuscles: { type: [String], enum: MUSCLE_IDS, default: undefined },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  totalVolume: { type: Number, required: true },
  totalSets: { type: Number, required: true },
  workoutData: activeWorkoutSchema,
});

/** Mongoose model for completed workout sessions and embedded active workout snapshots. */
module.exports = mongoose.model('CompletedWorkout', completedWorkoutSchema);
