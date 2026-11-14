const express = require('express');
const router = express.Router();
const {
  getFoods,
  getFoodByName,
  upsertFood,
} = require('../controllers/foodController');

router.get('/', getFoods);
router.get('/:name', getFoodByName);
router.post('/', upsertFood);

/** Express router for canonical food catalog endpoints. */
module.exports = router;
