const CompletedWorkout = require('../models/CompletedWorkout');

const getWorkouts = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { userId: req.userId || 'default_user' };

    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate);
      if (endDate) query.startTime.$lte = new Date(endDate);
    }

    const workouts = await CompletedWorkout.find(query).sort({ startTime: -1 });
    res.json(workouts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createWorkout = async (req, res) => {
  try {
    const workout = new CompletedWorkout({
      ...req.body,
      userId: req.userId || 'default_user'
    });
    await workout.save();
    res.json(workout);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateWorkoutName = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const workout = await CompletedWorkout.findOneAndUpdate(
      { id, userId: req.userId || 'default_user' },
      { name },
      { new: true }
    );
    res.json(workout);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteWorkout = async (req, res) => {
  try {
    const { id } = req.params;
    await CompletedWorkout.findOneAndDelete({ id, userId: req.userId || 'default_user' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getWorkouts,
  createWorkout,
  updateWorkoutName,
  deleteWorkout
};
