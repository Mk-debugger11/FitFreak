const Exercise = require('../models/Exercise');
const defaultCatalog = require('../data/exerciseCatalog.json');
const {
  EQUIPMENT_TYPES,
  LEGACY_CATEGORY_ALIASES,
  normalizeExerciseName,
  sanitizeMuscleTargets,
} = require('../constants/muscles');

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

const buildCatalogBulkOps = () =>
  defaultCatalog.map((item) => {
    const normalizedName = normalizeExerciseName(item.name);
    const { primaryMuscles, secondaryMuscles, stabilizerMuscles } = sanitizeMuscleTargets({
      primaryMuscles: item.primaryMuscles,
      secondaryMuscles: item.secondaryMuscles,
      stabilizerMuscles: item.stabilizerMuscles,
    });
    return {
      updateOne: {
        filter: { normalizedName },
        update: {
          $set: {
            name: item.name.trim(),
            normalizedName,
            aliases: sanitizeAliases(item.aliases),
            muscleGroup: item.muscleGroup.trim(),
            equipmentType: EQUIPMENT_TYPES.includes(item.equipmentType)
              ? item.equipmentType
              : 'barbell',
            primaryMuscles,
            secondaryMuscles,
            stabilizerMuscles,
            notes: typeof item.notes === 'string' ? item.notes : '',
          },
        },
        upsert: true,
      },
    };
  });

/** Lazily upserts default catalog exercises when the Exercise collection is empty. */
const ensureExercisesSeeded = async () => {
  const count = await Exercise.countDocuments();
  if (count > 0) return;
  const ops = buildCatalogBulkOps();
  if (ops.length > 0) {
    await Exercise.bulkWrite(ops, { ordered: false });
  }
};

/** Returns all exercises (optionally filtered by muscleGroup), sorted by muscleGroup and name. */
const getExercises = async (req, res) => {
  try {
    await ensureExercisesSeeded();

    const query = {};
    const { muscleGroup } = req.query || {};
    if (typeof muscleGroup === 'string' && muscleGroup.trim()) {
      const trimmed = muscleGroup.trim();
      query.muscleGroup = LEGACY_CATEGORY_ALIASES[trimmed] || trimmed;
    }

    const exercises = await Exercise.find(query).sort({ muscleGroup: 1, name: 1 });
    res.json(exercises);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Finds a single exercise by normalized canonical name or normalized alias. */
const getExerciseByName = async (req, res) => {
  try {
    const targetNorm = normalizeExerciseName(req.params.name);
    if (!targetNorm) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    await ensureExercisesSeeded();

    let exercise = await Exercise.findOne({ normalizedName: targetNorm });
    if (!exercise) {
      const allExercises = await Exercise.find({});
      exercise =
        allExercises.find(
          (entry) =>
            Array.isArray(entry.aliases) &&
            entry.aliases.some((alias) => normalizeExerciseName(alias) === targetNorm)
        ) || null;
    }

    if (!exercise) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    return res.json(exercise);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** Validates, sanitizes, and upserts an exercise record keyed by normalizedName. */
const upsertExercise = async (req, res) => {
  try {
    const {
      name,
      aliases,
      muscleGroup,
      equipmentType,
      primaryMuscles,
      secondaryMuscles,
      stabilizerMuscles,
      notes,
    } = req.body || {};

    if (typeof name !== 'string' || !name.trim() || !normalizeExerciseName(name)) {
      return res.status(400).json({ error: 'Exercise name is required' });
    }

    if (typeof muscleGroup !== 'string' || !muscleGroup.trim()) {
      return res.status(400).json({ error: 'Muscle group is required' });
    }

    const resolvedEquipment = equipmentType === undefined ? 'barbell' : equipmentType;
    if (!EQUIPMENT_TYPES.includes(resolvedEquipment)) {
      return res.status(400).json({
        error: `Invalid equipmentType. Expected one of: ${EQUIPMENT_TYPES.join(', ')}`,
      });
    }

    const trimmedName = name.trim();
    const normalizedName = normalizeExerciseName(trimmedName);
    const trimmedGroup = muscleGroup.trim();
    const resolvedGroup = LEGACY_CATEGORY_ALIASES[trimmedGroup] || trimmedGroup;

    const {
      primaryMuscles: cleanPrimary,
      secondaryMuscles: cleanSecondary,
      stabilizerMuscles: cleanStabilizer,
    } = sanitizeMuscleTargets({
      primaryMuscles,
      secondaryMuscles,
      stabilizerMuscles,
    });

    const updateSet = {
      name: trimmedName,
      normalizedName,
      muscleGroup: resolvedGroup,
      equipmentType: resolvedEquipment,
      primaryMuscles: cleanPrimary,
      secondaryMuscles: cleanSecondary,
      stabilizerMuscles: cleanStabilizer,
    };

    if (Array.isArray(aliases)) {
      updateSet.aliases = sanitizeAliases(aliases);
    }

    if (typeof notes === 'string') {
      updateSet.notes = notes;
    }

    const saved = await Exercise.findOneAndUpdate(
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
  getExercises,
  getExerciseByName,
  upsertExercise,
};
