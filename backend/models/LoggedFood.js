const mongoose = require('mongoose');
const { MEAL_TYPES, FOOD_BASES } = require('../constants/nutrition');

const loggedFoodMacrosSchema = new mongoose.Schema(
  {
    calories: { type: Number, required: true, default: 0 },
    protein: { type: Number, required: true, default: 0 },
    carbs: { type: Number, required: true, default: 0 },
    fat: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const loggedFoodSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, default: 'default_user' },
    id: { type: String, required: true, unique: true },
    dateString: { type: String, required: true },
    mealType: { type: String, enum: MEAL_TYPES, required: true },
    foodName: { type: String, required: true, trim: true },
    basis: { type: String, enum: FOOD_BASES, required: true },
    quantity: { type: Number, required: true },
    servingLabel: { type: String },
    macros: { type: loggedFoodMacrosSchema, required: true },
    foodId: { type: String },
    loggedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

loggedFoodSchema.index({ userId: 1, dateString: 1 });

/** Mongoose model for logged nutrition food entries. */
module.exports = mongoose.model('LoggedFood', loggedFoodSchema);
