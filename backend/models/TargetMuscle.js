const mongoose = require('mongoose');

const targetMuscleSchema = new mongoose.Schema({
  userId: { type: String, default: 'default_user' },
  dateString: { type: String, required: true }, // Format: YYYY-MM-DD
  muscles: [{ type: String }]
});

// Ensure only one entry per user per date
targetMuscleSchema.index({ userId: 1, dateString: 1 }, { unique: true });

module.exports = mongoose.model('TargetMuscle', targetMuscleSchema);
