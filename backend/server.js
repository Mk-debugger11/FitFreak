require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const CompletedWorkout = require('./models/CompletedWorkout');
const TargetMuscle = require('./models/TargetMuscle');
const CustomExercise = require('./models/CustomExercise');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const USER_ID = 'default_user';

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- API Endpoints ---

// Target Muscles
app.get('/api/target-muscles', async (req, res) => {
  try {
    const muscles = await TargetMuscle.find({ userId: USER_ID });
    res.json(muscles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/target-muscles', async (req, res) => {
  try {
    const { dateString, muscleGroup } = req.body;
    let record = await TargetMuscle.findOne({ userId: USER_ID, dateString });
    if (!record) {
      record = new TargetMuscle({ userId: USER_ID, dateString, muscles: [muscleGroup] });
    } else if (!record.muscles.includes(muscleGroup)) {
      record.muscles.push(muscleGroup);
    }
    await record.save();
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/target-muscles', async (req, res) => {
  try {
    const { dateString, muscleGroup } = req.body;
    let record = await TargetMuscle.findOne({ userId: USER_ID, dateString });
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
});

// Custom Exercises
app.get('/api/custom-exercises', async (req, res) => {
  try {
    const exercises = await CustomExercise.find({ userId: USER_ID });
    res.json(exercises);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/custom-exercises', async (req, res) => {
  try {
    const { category, exerciseName, equipmentType } = req.body;
    let record = await CustomExercise.findOne({ userId: USER_ID, category });
    
    const newExercise = { 
      name: exerciseName.trim(), 
      equipmentType: equipmentType || 'barbell' 
    };

    if (!record) {
      record = new CustomExercise({ userId: USER_ID, category, exercises: [newExercise] });
    } else {
      // Check if it exists (handling both old string format and new object format)
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
});

// Completed Workouts
app.get('/api/workouts', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { userId: USER_ID };
    
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
});

app.post('/api/workouts', async (req, res) => {
  try {
    const workout = new CompletedWorkout({ ...req.body, userId: USER_ID });
    await workout.save();
    res.json(workout);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/workouts/:id/name', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const workout = await CompletedWorkout.findOneAndUpdate(
      { id, userId: USER_ID },
      { name },
      { new: true }
    );
    res.json(workout);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/workouts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await CompletedWorkout.findOneAndDelete({ id, userId: USER_ID });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
