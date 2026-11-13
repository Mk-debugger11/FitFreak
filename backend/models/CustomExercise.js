const mongoose = require('mongoose');
const { EQUIPMENT_TYPES, MUSCLE_IDS } = require('../constants/muscles');

const customExerciseSchema = new mongoose.Schema({
  userId: { type: String, default: 'default_user' },
  category: { type: String, required: true },
  exercises: [
    {
      name: { type: String, required: true },
      equipmentType: { type: String, enum: EQUIPMENT_TYPES, default: 'barbell' },
      primaryMuscles: { type: [String], enum: MUSCLE_IDS, default: [] },
      secondaryMuscles: { type: [String], enum: MUSCLE_IDS, default: [] },
      stabilizerMuscles: { type: [String], enum: MUSCLE_IDS, default: [] },
    },
  ],
});

customExerciseSchema.index({ userId: 1, category: 1 }, { unique: true });

/** Mongoose model for user-defined exercises grouped by muscle category. */
module.exports = mongoose.model('CustomExercise', customExerciseSchema);
