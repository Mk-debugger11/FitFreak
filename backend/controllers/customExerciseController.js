const CustomExercise = require('../models/CustomExercise');
const Exercise = require('../models/Exercise');
const defaultCatalog = require('../data/exerciseCatalog.json');
const {
  EQUIPMENT_TYPES,
  normalizeExerciseName,
  resolveTargetsForExercise,
  sanitizeMuscleTargets,
} = require('../constants/muscles');

const loadExerciseCatalog = async () => {
  const dbExercises = await Exercise.find({}).lean();
  return dbExercises.length > 0 ? [...dbExercises, ...defaultCatalog] : defaultCatalog;
};

const hasAnyTargets = ({ primaryMuscles, secondaryMuscles, stabilizerMuscles }) =>
  primaryMuscles.length > 0 || secondaryMuscles.length > 0 || stabilizerMuscles.length > 0;

const hasTargets = (exercise) => {
  if (!exercise || typeof exercise === 'string') return false;
  return hasAnyTargets(sanitizeMuscleTargets(exercise));
};

const enrichExerciseEntry = (entry, category, catalog) => {
  if (typeof entry === 'string') {
    const resolved = resolveTargetsForExercise({ name: entry, category }, catalog);
    return {
      name: entry,
      equipmentType: 'barbell',
      primaryMuscles: resolved.primaryMuscles,
      secondaryMuscles: resolved.secondaryMuscles,
      stabilizerMuscles: resolved.stabilizerMuscles,
    };
  }

  const plain = typeof entry.toObject === 'function' ? entry.toObject() : { ...entry };
  const sanitized = sanitizeMuscleTargets(plain);

  if (hasAnyTargets(sanitized)) {
    return {
      ...plain,
      ...sanitized,
    };
  }

  const resolved = resolveTargetsForExercise(
    { name: plain.name, category },
    catalog
  );
  return {
    ...plain,
    primaryMuscles: resolved.primaryMuscles,
    secondaryMuscles: resolved.secondaryMuscles,
    stabilizerMuscles: resolved.stabilizerMuscles,
  };
};

/** Returns the user's custom exercises grouped by category, backfilling missing muscle targets. */
const getCustomExercises = async (req, res) => {
  try {
    const records = await CustomExercise.find({ userId: req.userId || 'default_user' }).lean();
    if (records.length === 0) {
      return res.json([]);
    }

    const needsBackfill = records.some((record) =>
      (record.exercises || []).some((entry) => !hasTargets(entry))
    );
    const catalog = needsBackfill ? await loadExerciseCatalog() : defaultCatalog;

    const enriched = records.map((record) => ({
      ...record,
      exercises: (record.exercises || []).map((entry) =>
        enrichExerciseEntry(entry, record.category, catalog)
      ),
    }));

    return res.json(enriched);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** Adds (or updates muscle targets on) a custom exercise in the user's category list. */
const addCustomExercise = async (req, res) => {
  try {
    const {
      category,
      exerciseName,
      equipmentType,
      primaryMuscles,
      secondaryMuscles,
      stabilizerMuscles,
    } = req.body || {};

    if (typeof category !== 'string' || !category.trim()) {
      return res.status(400).json({ error: 'Category is required' });
    }
    if (typeof exerciseName !== 'string' || !exerciseName.trim()) {
      return res.status(400).json({ error: 'Exercise name is required' });
    }

    const userId = req.userId || 'default_user';
    const trimmedCategory = category.trim();
    const trimmedName = exerciseName.trim();

    const catalog = await loadExerciseCatalog();
    const resolvedTargets = resolveTargetsForExercise(
      {
        name: trimmedName,
        category: trimmedCategory,
        primaryMuscles,
        secondaryMuscles,
        stabilizerMuscles,
      },
      catalog
    );

    const resolvedEquipment = EQUIPMENT_TYPES.includes(equipmentType) ? equipmentType : 'barbell';
    const newExercise = {
      name: trimmedName,
      equipmentType: resolvedEquipment,
      primaryMuscles: resolvedTargets.primaryMuscles,
      secondaryMuscles: resolvedTargets.secondaryMuscles,
      stabilizerMuscles: resolvedTargets.stabilizerMuscles,
    };

    const existingRecord = await CustomExercise.findOne({
      userId,
      category: trimmedCategory,
    }).lean();

    if (!existingRecord) {
      const created = await CustomExercise.create({
        userId,
        category: trimmedCategory,
        exercises: [newExercise],
      });
      return res.json(created);
    }

    const targetNorm = normalizeExerciseName(trimmedName);
    const nextExercises = (existingRecord.exercises || []).map((entry) =>
      typeof entry === 'string' ? enrichExerciseEntry(entry, trimmedCategory, catalog) : { ...entry }
    );

    const existingIndex = nextExercises.findIndex((ex) => {
      const name = typeof ex === 'string' ? ex : ex.name;
      return (
        name.toLowerCase() === trimmedName.toLowerCase() ||
        normalizeExerciseName(name) === targetNorm
      );
    });

    if (existingIndex === -1) {
      nextExercises.push(newExercise);
    } else {
      const existing = nextExercises[existingIndex];
      const explicitTargets = sanitizeMuscleTargets({
        primaryMuscles,
        secondaryMuscles,
        stabilizerMuscles,
      });
      const hasExplicit = hasAnyTargets(explicitTargets);
      const wasLegacyString = typeof existingRecord.exercises[existingIndex] === 'string';

      if (wasLegacyString || hasExplicit) {
        nextExercises[existingIndex] = {
          ...existing,
          primaryMuscles: hasExplicit
            ? explicitTargets.primaryMuscles
            : resolvedTargets.primaryMuscles,
          secondaryMuscles: hasExplicit
            ? explicitTargets.secondaryMuscles
            : resolvedTargets.secondaryMuscles,
          stabilizerMuscles: hasExplicit
            ? explicitTargets.stabilizerMuscles
            : resolvedTargets.stabilizerMuscles,
          ...(EQUIPMENT_TYPES.includes(equipmentType) ? { equipmentType } : {}),
        };
      } else if (!hasTargets(existing)) {
        nextExercises[existingIndex] = {
          ...existing,
          primaryMuscles: resolvedTargets.primaryMuscles,
          secondaryMuscles: resolvedTargets.secondaryMuscles,
          stabilizerMuscles: resolvedTargets.stabilizerMuscles,
        };
      }
    }

    const updated = await CustomExercise.findOneAndUpdate(
      { _id: existingRecord._id },
      { $set: { exercises: nextExercises } },
      { returnDocument: 'after', runValidators: true }
    );
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getCustomExercises,
  addCustomExercise,
};
