const express = require('express');
const router = express.Router();
const {
  getCustomExercises,
  addCustomExercise
} = require('../controllers/customExerciseController');

router.get('/', getCustomExercises);
router.post('/', addCustomExercise);

module.exports = router;
