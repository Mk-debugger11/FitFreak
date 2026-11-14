const express = require('express');
const router = express.Router();
const {
  getCustomFoods,
  addCustomFood,
  deleteCustomFood,
} = require('../controllers/customFoodController');

router.get('/', getCustomFoods);
router.post('/', addCustomFood);
router.delete('/:id', deleteCustomFood);

/** Express router for user custom food endpoints. */
module.exports = router;
