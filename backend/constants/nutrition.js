const MEAL_TYPES = ['breakfast', 'lunch', 'snacks', 'dinner'];
const SEXES = ['male', 'female'];
const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const NUTRITION_GOALS = ['cut', 'maintain', 'bulk'];
const FOOD_CATEGORIES = [
  'Grains',
  'Protein',
  'Dairy',
  'Fruit',
  'Vegetables',
  'Nuts & Seeds',
  'Cooked Dishes',
  'Snacks',
  'Beverages',
  'Supplements',
  'Other',
];
const FOOD_BASES = ['per_100g', 'per_100ml', 'per_piece'];

const PROFILE_LIMITS = {
  weightKg: { min: 25, max: 300 },
  heightCm: { min: 100, max: 250 },
  age: { min: 13, max: 100 },
  bodyFatPercent: { min: 3, max: 60 },
};

/**
 * Normalizes a food name for case-, punctuation-, and whitespace-insensitive matching.
 * Lowercases, strips common apostrophes, replaces punctuation sequences with a single space, and trims.
 */
const normalizeFoodName = (name) => {
  if (typeof name !== 'string') return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
};

/**
 * Sanitizes macronutrients: coerces calories, protein, carbs, fat to non-negative numbers.
 * Derives calories from 4*P + 4*C + 9*F if missing or <= 0.
 */
const sanitizeMacros = (macros = {}) => {
  const rawP = Number(macros?.protein);
  const rawC = Number(macros?.carbs);
  const rawF = Number(macros?.fat);
  const rawCal = Number(macros?.calories);

  const protein = Number.isFinite(rawP) && rawP >= 0 ? Math.round(rawP * 10) / 10 : 0;
  const carbs = Number.isFinite(rawC) && rawC >= 0 ? Math.round(rawC * 10) / 10 : 0;
  const fat = Number.isFinite(rawF) && rawF >= 0 ? Math.round(rawF * 10) / 10 : 0;

  let calories = Number.isFinite(rawCal) && rawCal > 0 ? Math.round(rawCal) : 0;
  if (calories <= 0) {
    calories = Math.round(4 * protein + 4 * carbs + 9 * fat);
  }

  return { calories, protein, carbs, fat };
};

/**
 * Validates and sanitizes an array of serving objects: { label: string, grams: number }.
 */
const sanitizeServings = (servings) => {
  if (!Array.isArray(servings)) return [];
  const valid = [];
  for (const s of servings) {
    if (!s || typeof s !== 'object') continue;
    const label = typeof s.label === 'string' ? s.label.trim() : '';
    const grams = Number(s.grams);
    if (label && Number.isFinite(grams) && grams > 0) {
      valid.push({ label, grams: Math.round(grams * 10) / 10 });
    }
  }
  return valid;
};

module.exports = {
  MEAL_TYPES,
  SEXES,
  ACTIVITY_LEVELS,
  NUTRITION_GOALS,
  FOOD_CATEGORIES,
  FOOD_BASES,
  PROFILE_LIMITS,
  normalizeFoodName,
  sanitizeMacros,
  sanitizeServings,
};
