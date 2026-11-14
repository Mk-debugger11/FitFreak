const crypto = require('crypto');
const CustomFood = require('../models/CustomFood');
const {
  FOOD_CATEGORIES,
  FOOD_BASES,
  normalizeFoodName,
  sanitizeMacros,
  sanitizeServings,
} = require('../constants/nutrition');

/**
 * Returns all custom foods created by the current user, sorted by category and name.
 */
const getCustomFoods = async (req, res) => {
  try {
    const userId = req.userId || 'default_user';
    const customFoods = await CustomFood.find({ userId }).sort({ category: 1, name: 1 });
    return res.json(customFoods);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Validates, checks for duplicates, and creates/upserts a user custom food keyed by id.
 */
const addCustomFood = async (req, res) => {
  try {
    const userId = req.userId || 'default_user';
    const {
      id,
      name,
      category,
      basis,
      macros,
      servings,
      defaultQuantity,
      notes,
    } = req.body || {};

    if (typeof name !== 'string' || !name.trim() || !normalizeFoodName(name)) {
      return res.status(400).json({ error: 'Valid custom food name is required' });
    }

    if (!category || !FOOD_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: `Invalid category. Expected one of: ${FOOD_CATEGORIES.join(', ')}`,
      });
    }

    if (!basis || !FOOD_BASES.includes(basis)) {
      return res.status(400).json({
        error: `Invalid basis. Expected one of: ${FOOD_BASES.join(', ')}`,
      });
    }

    const trimmedName = name.trim();
    const normalizedName = normalizeFoodName(trimmedName);
    const foodId = (typeof id === 'string' && id.trim()) ? id.trim() : crypto.randomUUID();

    // Check for duplicate normalizedName for this user
    const existing = await CustomFood.findOne({ userId, normalizedName });
    if (existing && existing.id !== foodId) {
      return res.status(400).json({ error: 'A custom food with this name already exists' });
    }

    const cleanMacros = sanitizeMacros(macros);
    const cleanServings = sanitizeServings(servings);

    const updateSet = {
      userId,
      id: foodId,
      name: trimmedName,
      normalizedName,
      category,
      basis,
      macros: cleanMacros,
      servings: cleanServings,
      notes: typeof notes === 'string' ? notes : '',
    };

    if (typeof defaultQuantity === 'number' && Number.isFinite(defaultQuantity) && defaultQuantity > 0) {
      updateSet.defaultQuantity = defaultQuantity;
    }

    const customFood = await CustomFood.findOneAndUpdate(
      { id: foodId, userId },
      { $set: updateSet },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(201).json(customFood);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Deletes a user custom food item by ID.
 */
const deleteCustomFood = async (req, res) => {
  try {
    const userId = req.userId || 'default_user';
    const { id } = req.params;

    const result = await CustomFood.deleteOne({ id, userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Custom food not found' });
    }

    return res.json({ message: 'Custom food deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getCustomFoods,
  addCustomFood,
  deleteCustomFood,
};
