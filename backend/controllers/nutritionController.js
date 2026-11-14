const crypto = require('crypto');
const LoggedFood = require('../models/LoggedFood');
const {
  MEAL_TYPES,
  FOOD_BASES,
  sanitizeMacros,
} = require('../constants/nutrition');

/**
 * Returns logged nutrition entries for the current user, optionally filtered by date or date range.
 * Sorted chronologically by dateString asc, loggedAt asc.
 */
const getEntries = async (req, res) => {
  try {
    const userId = req.userId || 'default_user';
    const { startDate, endDate, date } = req.query || {};

    const query = { userId };

    if (date && typeof date === 'string') {
      query.dateString = date.trim();
    } else if (startDate || endDate) {
      query.dateString = {};
      if (startDate) query.dateString.$gte = String(startDate).trim();
      if (endDate) query.dateString.$lte = String(endDate).trim();
    }

    const entries = await LoggedFood.find(query).sort({ dateString: 1, loggedAt: 1 });
    return res.json(entries);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Validates and logs a food entry for the current user, keyed by id.
 */
const addEntry = async (req, res) => {
  try {
    const userId = req.userId || 'default_user';
    const {
      id,
      dateString,
      mealType,
      foodName,
      basis,
      quantity,
      servingLabel,
      macros,
      foodId,
      loggedAt,
    } = req.body || {};

    if (!mealType || !MEAL_TYPES.includes(mealType)) {
      return res.status(400).json({
        error: `Invalid mealType. Expected one of: ${MEAL_TYPES.join(', ')}`,
      });
    }

    if (typeof dateString !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) {
      return res.status(400).json({ error: 'Valid dateString (YYYY-MM-DD) is required' });
    }

    if (typeof foodName !== 'string' || !foodName.trim()) {
      return res.status(400).json({ error: 'foodName is required' });
    }

    if (!basis || !FOOD_BASES.includes(basis)) {
      return res.status(400).json({
        error: `Invalid basis. Expected one of: ${FOOD_BASES.join(', ')}`,
      });
    }

    const numQuantity = Number(quantity);
    if (!Number.isFinite(numQuantity) || numQuantity <= 0) {
      return res.status(400).json({ error: 'quantity must be a positive number' });
    }

    const entryId = typeof id === 'string' && id.trim() ? id.trim() : crypto.randomUUID();
    const cleanMacros = sanitizeMacros(macros);
    const parsedLoggedAt = loggedAt ? new Date(loggedAt) : new Date();

    const payload = {
      id: entryId,
      userId,
      dateString: dateString.trim(),
      mealType,
      foodName: foodName.trim(),
      basis,
      quantity: numQuantity,
      macros: cleanMacros,
      loggedAt: Number.isNaN(parsedLoggedAt.getTime()) ? new Date() : parsedLoggedAt,
    };

    if (typeof servingLabel === 'string' && servingLabel.trim()) {
      payload.servingLabel = servingLabel.trim();
    }

    if (typeof foodId === 'string' && foodId.trim()) {
      payload.foodId = foodId.trim();
    }

    const entry = await LoggedFood.findOneAndUpdate(
      { id: entryId, userId },
      { $set: payload },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(201).json(entry);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Updates an existing logged nutrition entry by ID.
 */
const updateEntry = async (req, res) => {
  try {
    const userId = req.userId || 'default_user';
    const { id } = req.params;
    const {
      dateString,
      mealType,
      foodName,
      basis,
      quantity,
      servingLabel,
      macros,
      foodId,
      loggedAt,
    } = req.body || {};

    const payload = {};

    if (mealType !== undefined) {
      if (!MEAL_TYPES.includes(mealType)) {
        return res.status(400).json({
          error: `Invalid mealType. Expected one of: ${MEAL_TYPES.join(', ')}`,
        });
      }
      payload.mealType = mealType;
    }

    if (dateString !== undefined) {
      if (typeof dateString !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) {
        return res.status(400).json({ error: 'Valid dateString (YYYY-MM-DD) is required' });
      }
      payload.dateString = dateString.trim();
    }

    if (foodName !== undefined) {
      if (typeof foodName !== 'string' || !foodName.trim()) {
        return res.status(400).json({ error: 'foodName cannot be empty' });
      }
      payload.foodName = foodName.trim();
    }

    if (basis !== undefined) {
      if (!FOOD_BASES.includes(basis)) {
        return res.status(400).json({
          error: `Invalid basis. Expected one of: ${FOOD_BASES.join(', ')}`,
        });
      }
      payload.basis = basis;
    }

    if (quantity !== undefined) {
      const numQty = Number(quantity);
      if (!Number.isFinite(numQty) || numQty <= 0) {
        return res.status(400).json({ error: 'quantity must be a positive number' });
      }
      payload.quantity = numQty;
    }

    if (servingLabel !== undefined) {
      payload.servingLabel = typeof servingLabel === 'string' ? servingLabel.trim() : '';
    }

    if (macros !== undefined) {
      payload.macros = sanitizeMacros(macros);
    }

    if (foodId !== undefined) {
      payload.foodId = typeof foodId === 'string' ? foodId.trim() : undefined;
    }

    if (loggedAt !== undefined) {
      const parsedLoggedAt = new Date(loggedAt);
      if (!Number.isNaN(parsedLoggedAt.getTime())) {
        payload.loggedAt = parsedLoggedAt;
      }
    }

    const updated = await LoggedFood.findOneAndUpdate(
      { id, userId },
      { $set: payload },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Nutrition entry not found' });
    }

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Deletes a logged nutrition entry by ID.
 */
const deleteEntry = async (req, res) => {
  try {
    const userId = req.userId || 'default_user';
    const { id } = req.params;

    const result = await LoggedFood.deleteOne({ id, userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Nutrition entry not found' });
    }

    return res.json({ message: 'Nutrition entry deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getEntries,
  addEntry,
  updateEntry,
  deleteEntry,
};
