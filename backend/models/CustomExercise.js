const mongoose = require('mongoose');

const customExerciseSchema = new mongoose.Schema({
  userId: { type: String, default: 'default_user' },
  category: { type: String, required: true },
  exercises: [{
    name: { type: String, required: true },
    equipmentType: { type: String, enum: ['dumbbell', 'barbell', 'machine', 'cable', 'bodyweight'], default: 'barbell' }
  }]
});

// Ensure only one list of exercises per category per user
customExerciseSchema.index({ userId: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('CustomExercise', customExerciseSchema);
