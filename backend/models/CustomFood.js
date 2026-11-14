const mongoose = require('mongoose');
const { FOOD_CATEGORIES, FOOD_BASES } = require('../constants/nutrition');

const customFoodServingSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    grams: { type: Number, required: true },
  },
  { _id: false }
);

const customFoodMacrosSchema = new mongoose.Schema(
  {
    calories: { type: Number, required: true, default: 0 },
    protein: { type: Number, required: true, default: 0 },
    carbs: { type: Number, required: true, default: 0 },
    fat: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const customFoodSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, default: 'default_user' },
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true },
    category: { type: String, enum: FOOD_CATEGORIES, required: true },
    basis: { type: String, enum: FOOD_BASES, required: true },
    macros: { type: customFoodMacrosSchema, required: true },
    servings: { type: [customFoodServingSchema], default: [] },
    defaultQuantity: { type: Number },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

customFoodSchema.index({ userId: 1, normalizedName: 1 }, { unique: true });

/** Mongoose model for user-defined custom foods. */
module.exports = mongoose.model('CustomFood', customFoodSchema);
