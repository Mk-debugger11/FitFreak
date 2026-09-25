const TargetMuscle = require('../models/TargetMuscle');

const getTargetMuscles = async (req, res) => {
  try {
    const muscles = await TargetMuscle.find({ userId: req.userId || 'default_user' });
    res.json(muscles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const addTargetMuscle = async (req, res) => {
  try {
    const { dateString, muscleGroup } = req.body;
    const userId = req.userId || 'default_user';
    let record = await TargetMuscle.findOne({ userId, dateString });
    if (!record) {
      record = new TargetMuscle({ userId, dateString, muscles: [muscleGroup] });
    } else if (!record.muscles.includes(muscleGroup)) {
      record.muscles.push(muscleGroup);
    }
    await record.save();
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteTargetMuscle = async (req, res) => {
  try {
    const { dateString, muscleGroup } = req.body;
    const userId = req.userId || 'default_user';
    let record = await TargetMuscle.findOne({ userId, dateString });
    if (record) {
      record.muscles = record.muscles.filter(m => m !== muscleGroup);
      await record.save();
      res.json(record);
    } else {
      res.json({ message: 'No record found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getTargetMuscles,
  addTargetMuscle,
  deleteTargetMuscle
};
