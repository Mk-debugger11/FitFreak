const CompletedWorkout = require('../models/CompletedWorkout');
const CustomExercise = require('../models/CustomExercise');
const Exercise = require('../models/Exercise');
const defaultCatalog = require('../data/exerciseCatalog.json');
const { resolveTargetsForExercise, sanitizeMuscleTargets } = require('../constants/muscles');

const loadLookupCatalog = async (userId) => {
  const [dbExercises, customDocs] = await Promise.all([
    Exercise.find({}).lean(),
    CustomExercise.find({ userId }).lean(),
  ]);

  const populatedCustom = [];
  for (const doc of customDocs) {
    for (const entry of doc.exercises || []) {
      if (!entry || typeof entry === 'string') continue;
      const targets = sanitizeMuscleTargets(entry);
      if (
        targets.primaryMuscles.length > 0 ||
        targets.secondaryMuscles.length > 0 ||
        targets.stabilizerMuscles.length > 0
      ) {
        populatedCustom.push({
          name: entry.name,
          muscleGroup: doc.category,
          ...targets,
        });
      }
    }
  }

  return [...dbExercises, ...defaultCatalog, ...populatedCustom];
};

const extractExplicitTargets = (primaryMuscles, secondaryMuscles, stabilizerMuscles) => {
  const targets = sanitizeMuscleTargets({
    primaryMuscles,
    secondaryMuscles,
    stabilizerMuscles,
  });
  if (
    targets.primaryMuscles.length === 0 &&
    targets.secondaryMuscles.length === 0 &&
    targets.stabilizerMuscles.length === 0
  ) {
    return null;
  }
  return targets;
};

/** Returns completed workouts for the current user, optionally filtered by startTime date range. */
const getWorkouts = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { userId: req.userId || 'default_user' };

    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate);
      if (endDate) query.startTime.$lte = new Date(endDate);
    }

    const workouts = await CompletedWorkout.find(query).sort({ startTime: -1 });
    res.json(workouts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Saves a completed workout, sanitizing or auto-resolving target muscles on the workout and workoutData. */
const createWorkout = async (req, res) => {
  try {
    const payload = req.body || {};
    const userId = req.userId || 'default_user';
    const hasWorkoutData = Boolean(payload.workoutData && typeof payload.workoutData === 'object');

    const topExplicit = extractExplicitTargets(
      payload.primaryMuscles,
      payload.secondaryMuscles,
      payload.stabilizerMuscles
    );
    const wdExplicit = hasWorkoutData
      ? extractExplicitTargets(
          payload.workoutData.primaryMuscles,
          payload.workoutData.secondaryMuscles,
          payload.workoutData.stabilizerMuscles
        )
      : null;

    const needsCatalog = !topExplicit && !wdExplicit;
    const catalog = needsCatalog ? await loadLookupCatalog(userId) : defaultCatalog;

    const topTargets =
      topExplicit ||
      wdExplicit ||
      resolveTargetsForExercise(
        {
          name: payload.name,
          category: payload.category,
        },
        catalog
      );

    const workoutPayload = {
      ...payload,
      userId,
      primaryMuscles: topTargets.primaryMuscles,
      secondaryMuscles: topTargets.secondaryMuscles,
      stabilizerMuscles: topTargets.stabilizerMuscles,
    };

    if (hasWorkoutData) {
      const wdTargets =
        wdExplicit ||
        topExplicit ||
        resolveTargetsForExercise(
          {
            name: payload.workoutData.name ?? payload.name,
            category: payload.workoutData.category ?? payload.category,
          },
          catalog
        );

      workoutPayload.workoutData = {
        ...payload.workoutData,
        primaryMuscles: wdTargets.primaryMuscles,
        secondaryMuscles: wdTargets.secondaryMuscles,
        stabilizerMuscles: wdTargets.stabilizerMuscles,
      };
    }

    const workout = new CompletedWorkout(workoutPayload);
    await workout.save();
    res.json(workout);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Updates the display name of an existing completed workout by ID and refreshes its muscle targets. */
const updateWorkoutName = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.userId || 'default_user';

    const existing = await CompletedWorkout.findOne({ id, userId });
    if (!existing) {
      return res.json(null);
    }

    const catalog = await loadLookupCatalog(userId);
    const targets = resolveTargetsForExercise(
      { name, category: existing.category },
      catalog
    );

    const updateDoc = {
      name,
      primaryMuscles: targets.primaryMuscles,
      secondaryMuscles: targets.secondaryMuscles,
      stabilizerMuscles: targets.stabilizerMuscles,
      ...(existing.workoutData
        ? {
            'workoutData.name': name,
            'workoutData.primaryMuscles': targets.primaryMuscles,
            'workoutData.secondaryMuscles': targets.secondaryMuscles,
            'workoutData.stabilizerMuscles': targets.stabilizerMuscles,
          }
        : {}),
    };

    const workout = await CompletedWorkout.findOneAndUpdate(
      { id, userId },
      { $set: updateDoc },
      { returnDocument: 'after' }
    );
    res.json(workout);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Deletes a completed workout by ID for the current user. */
const deleteWorkout = async (req, res) => {
  try {
    const { id } = req.params;
    await CompletedWorkout.findOneAndDelete({ id, userId: req.userId || 'default_user' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getWorkouts,
  createWorkout,
  updateWorkoutName,
  deleteWorkout,
};
