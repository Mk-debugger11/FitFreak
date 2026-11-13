const express = require('express');
const router = express.Router();
const {
  getExercises,
  getExerciseByName,
  upsertExercise,
} = require('../controllers/exerciseController');

router.get('/', getExercises);
router.get('/:name', getExerciseByName);
router.post('/', upsertExercise);

/** Express router for canonical exercise catalog endpoints. */
module.exports = router;
