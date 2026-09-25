const mongoose = require('mongoose');

const targetMuscleSchema = new mongoose.Schema({
  userId: { type: String, default: 'default_user' },
  dateString: { type: String, required: true },
  muscles: [{ type: String }]
});

targetMuscleSchema.index({ userId: 1, dateString: 1 }, { unique: true });

module.exports = mongoose.model('TargetMuscle', targetMuscleSchema);
