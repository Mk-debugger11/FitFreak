const mongoose = require('mongoose');
const { SEXES, ACTIVITY_LEVELS, NUTRITION_GOALS } = require('../constants/nutrition');

const userProfileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    sex: { type: String, enum: SEXES, required: true },
    heightCm: { type: Number, required: true },
    weightKg: { type: Number, required: true },
    birthDate: { type: Date, required: true },
    activityLevel: { type: String, enum: ACTIVITY_LEVELS, required: true },
    goal: { type: String, enum: NUTRITION_GOALS, required: true },
    bodyFatPercent: { type: Number },
    maintenanceOverride: { type: Number },
    proteinPerKg: { type: Number },
  },
  { timestamps: true }
);

/** Mongoose model for user nutrition and metabolic profiles. */
module.exports = mongoose.model('UserProfile', userProfileSchema);
