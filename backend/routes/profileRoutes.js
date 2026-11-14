const express = require('express');
const router = express.Router();
const {
  getProfile,
  upsertProfile,
} = require('../controllers/profileController');

router.get('/', getProfile);
router.put('/', upsertProfile);

/** Express router for user profile endpoints. */
module.exports = router;
