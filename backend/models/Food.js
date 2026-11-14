const mongoose = require('mongoose');
const { FOOD_CATEGORIES, FOOD_BASES } = require('../constants/nutrition');

const foodServingSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    grams: { type: Number, required: true },
  },
  { _id: false }
);

const foodMacrosSchema = new mongoose.Schema(
  {
    calories: { type: Number, required: true, default: 0 },
    protein: { type: Number, required: true, default: 0 },
    carbs: { type: Number, required: true, default: 0 },
    fat: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const foodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, unique: true },
    aliases: { type: [String], default: [] },
    category: { type: String, enum: FOOD_CATEGORIES, required: true },
    basis: { type: String, enum: FOOD_BASES, required: true },
    macros: { type: foodMacrosSchema, required: true },
    servings: { type: [foodServingSchema], default: [] },
    defaultQuantity: { type: Number },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

/** Mongoose model for canonical food catalog items. */
module.exports = mongoose.model('Food', foodSchema);
