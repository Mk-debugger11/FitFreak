const mongoose = require('mongoose');
const { EQUIPMENT_TYPES, MUSCLE_IDS } = require('../constants/muscles');

const exerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, unique: true },
    aliases: { type: [String], default: [] },
    muscleGroup: { type: String, required: true, trim: true },
    equipmentType: { type: String, enum: EQUIPMENT_TYPES, default: 'barbell' },
    primaryMuscles: { type: [String], enum: MUSCLE_IDS, default: [] },
    secondaryMuscles: { type: [String], enum: MUSCLE_IDS, default: [] },
    stabilizerMuscles: { type: [String], enum: MUSCLE_IDS, default: [] },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

/** Mongoose model for the canonical exercise catalog and muscle targets. */
module.exports = mongoose.model('Exercise', exerciseSchema);
