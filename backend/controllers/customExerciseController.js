const CustomExercise = require('../models/CustomExercise');

const getCustomExercises = async (req, res) => {
  try {
    const exercises = await CustomExercise.find({ userId: req.userId || 'default_user' });
    res.json(exercises);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const addCustomExercise = async (req, res) => {
  try {
    const { category, exerciseName, equipmentType } = req.body;
    const userId = req.userId || 'default_user';
    let record = await CustomExercise.findOne({ userId, category });

    const newExercise = {
      name: exerciseName.trim(),
      equipmentType: equipmentType || 'barbell'
    };

    if (!record) {
      record = new CustomExercise({ userId, category, exercises: [newExercise] });
    } else {
      const exists = record.exercises.some(ex => {
        const name = typeof ex === 'string' ? ex : ex.name;
        return name.toLowerCase() === exerciseName.trim().toLowerCase();
      });
      if (!exists) {
        record.exercises.push(newExercise);
      }
    }
    await record.save();
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getCustomExercises,
  addCustomExercise
};
