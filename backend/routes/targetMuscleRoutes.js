const express = require('express');
const router = express.Router();
const {
  getTargetMuscles,
  addTargetMuscle,
  deleteTargetMuscle
} = require('../controllers/targetMuscleController');

router.get('/', getTargetMuscles);
router.post('/', addTargetMuscle);
router.delete('/', deleteTargetMuscle);

module.exports = router;
