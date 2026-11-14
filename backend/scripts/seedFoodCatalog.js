require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Food = require('../models/Food');
const foodCatalog = require('../data/foodCatalog.json');
const {
  normalizeFoodName,
  sanitizeMacros,
  sanitizeServings,
} = require('../constants/nutrition');

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

const seedFoods = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not found in environment.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB.');

    const ops = foodCatalog.map((item) => {
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

    const result = await Food.bulkWrite(ops, { ordered: false });
    console.log(`Seeding complete: matched ${result.matchedCount}, upserted ${result.upsertedCount}, modified ${result.modifiedCount}`);

    const totalCount = await Food.countDocuments();
    console.log(`Total Food documents in database: ${totalCount}`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedFoods();
