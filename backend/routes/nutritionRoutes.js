const express = require('express');
const router = express.Router();
const {
  getEntries,
  addEntry,
  updateEntry,
  deleteEntry,
} = require('../controllers/nutritionController');

router.get('/', getEntries);
router.post('/', addEntry);
router.put('/:id', updateEntry);
router.delete('/:id', deleteEntry);

/** Express router for logged nutrition food entries. */
module.exports = router;
