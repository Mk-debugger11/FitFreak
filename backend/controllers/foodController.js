const Food = require('../models/Food');
const foodCatalog = require('../data/foodCatalog.json');
const {
  FOOD_CATEGORIES,
  FOOD_BASES,
  normalizeFoodName,
  sanitizeMacros,
  sanitizeServings,
} = require('../constants/nutrition');

/**
 * Deduplicates and strips empty alias strings.
 */
const sanitizeAliases = (aliases) => {
  if (!Array.isArray(aliases)) return [];
  const seen = new Set();
  const result = [];
  for (const alias of aliases) {
    if (typeof alias !== 'string') continue;
    const trimmed = alias.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
};

/**
 * Builds bulk operations to populate the Food collection from foodCatalog.json.
 */
const buildFoodCatalogBulkOps = () =>
  foodCatalog.map((item) => {
    const normalizedName = normalizeFoodName(item.name);
    return {
      updateOne: {
        filter: { normalizedName },
        update: {
          $set: {
            name: item.name.trim(),
            normalizedName,
            aliases: sanitizeAliases(item.aliases),
            category: item.category,
            basis: item.basis,
            macros: sanitizeMacros(item.macros),
            servings: sanitizeServings(item.servings),
            defaultQuantity:
              typeof item.defaultQuantity === 'number' ? item.defaultQuantity : undefined,
            notes: typeof item.notes === 'string' ? item.notes : '',
          },
        },
        upsert: true,
      },
    };
  });

/**
 * Lazily seeds the Food collection with the default catalog if it is currently empty.
 */
const ensureFoodsSeeded = async () => {
  const count = await Food.countDocuments();
  if (count > 0) return;
  const ops = buildFoodCatalogBulkOps();
  if (ops.length > 0) {
    await Food.bulkWrite(ops, { ordered: false });
  }
};

/**
 * Returns all canonical food items, sorted by category and name.
 */
const getFoods = async (req, res) => {
  try {
    await ensureFoodsSeeded();

    const query = {};
    const { category } = req.query || {};
    if (typeof category === 'string' && category.trim()) {
      query.category = category.trim();
    }

    const foods = await Food.find(query).sort({ category: 1, name: 1 });
    return res.json(foods);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Finds a single food item by normalized canonical name or alias.
 */
const getFoodByName = async (req, res) => {
  try {
    const targetNorm = normalizeFoodName(req.params.name);
    if (!targetNorm) {
      return res.status(404).json({ error: 'Food not found' });
    }

    await ensureFoodsSeeded();

    let food = await Food.findOne({ normalizedName: targetNorm });
    if (!food) {
      const allFoods = await Food.find({});
      food =
        allFoods.find(
          (entry) =>
            Array.isArray(entry.aliases) &&
            entry.aliases.some((alias) => normalizeFoodName(alias) === targetNorm)
        ) || null;
    }

    if (!food) {
      return res.status(404).json({ error: 'Food not found' });
    }

    return res.json(food);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Validates, sanitizes, and upserts a canonical food record keyed by normalizedName.
 */
const upsertFood = async (req, res) => {
  try {
    const {
      name,
      aliases,
      category,
      basis,
      macros,
      servings,
      defaultQuantity,
      notes,
    } = req.body || {};

    if (typeof name !== 'string' || !name.trim() || !normalizeFoodName(name)) {
      return res.status(400).json({ error: 'Food name is required' });
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
    const cleanMacros = sanitizeMacros(macros);
    const cleanServings = sanitizeServings(servings);

    const updateSet = {
      name: trimmedName,
      normalizedName,
      aliases: sanitizeAliases(aliases),
      category,
      basis,
      macros: cleanMacros,
      servings: cleanServings,
      notes: typeof notes === 'string' ? notes : '',
    };

    if (typeof defaultQuantity === 'number' && Number.isFinite(defaultQuantity) && defaultQuantity > 0) {
      updateSet.defaultQuantity = defaultQuantity;
    }

    const saved = await Food.findOneAndUpdate(
      { normalizedName },
      { $set: updateSet },
      {
        returnDocument: 'after',
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.json(saved);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  ensureFoodsSeeded,
  getFoods,
  getFoodByName,
  upsertFood,
};
