require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const auth = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

const workoutRoutes = require('./routes/workoutRoutes');
const targetMuscleRoutes = require('./routes/targetMuscleRoutes');
const customExerciseRoutes = require('./routes/customExerciseRoutes');
const exerciseRoutes = require('./routes/exerciseRoutes');
const profileRoutes = require('./routes/profileRoutes');
const foodRoutes = require('./routes/foodRoutes');
const customFoodRoutes = require('./routes/customFoodRoutes');
const nutritionRoutes = require('./routes/nutritionRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

app.use(cors());
app.use(express.json());
app.use(auth);

app.use('/api/workouts', workoutRoutes);
app.use('/api/target-muscles', targetMuscleRoutes);
app.use('/api/custom-exercises', customExerciseRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/custom-foods', customFoodRoutes);
app.use('/api/nutrition-entries', nutritionRoutes);

app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
