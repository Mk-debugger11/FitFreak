const express = require('express');
const router = express.Router();
const {
  getWorkouts,
  createWorkout,
  updateWorkoutName,
  deleteWorkout
} = require('../controllers/workoutController');

router.get('/', getWorkouts);
router.post('/', createWorkout);
router.put('/:id/name', updateWorkoutName);
router.delete('/:id', deleteWorkout);

module.exports = router;
