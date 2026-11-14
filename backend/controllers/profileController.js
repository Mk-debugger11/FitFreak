const UserProfile = require('../models/UserProfile');
const {
  SEXES,
  ACTIVITY_LEVELS,
  NUTRITION_GOALS,
  PROFILE_LIMITS,
} = require('../constants/nutrition');

/**
 * Calculates current age in years given a birthDate.
 */
const calculateAge = (birthDate, onDate = new Date()) => {
  let age = onDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = onDate.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && onDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

/**
 * Returns the current user's profile, or null if not yet configured. Never returns 404.
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.userId || 'default_user';
    const profile = await UserProfile.findOne({ userId });
    return res.json(profile || null);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Validates, clamps, and upserts the user's nutrition and metabolic profile.
 */
const upsertProfile = async (req, res) => {
  try {
    const userId = req.userId || 'default_user';
    const {
      sex,
      heightCm,
      weightKg,
      birthDate,
      activityLevel,
      goal,
      bodyFatPercent,
      maintenanceOverride,
      proteinPerKg,
    } = req.body || {};

    if (!sex || !SEXES.includes(sex)) {
      return res.status(400).json({
        error: `Invalid sex. Expected one of: ${SEXES.join(', ')}`,
      });
    }

    if (!activityLevel || !ACTIVITY_LEVELS.includes(activityLevel)) {
      return res.status(400).json({
        error: `Invalid activityLevel. Expected one of: ${ACTIVITY_LEVELS.join(', ')}`,
      });
    }

    if (!goal || !NUTRITION_GOALS.includes(goal)) {
      return res.status(400).json({
        error: `Invalid goal. Expected one of: ${NUTRITION_GOALS.join(', ')}`,
      });
    }

    const numWeight = Number(weightKg);
    if (!Number.isFinite(numWeight)) {
      return res.status(400).json({ error: 'Valid weightKg is required' });
    }
    const clampedWeight = Math.min(
      PROFILE_LIMITS.weightKg.max,
      Math.max(PROFILE_LIMITS.weightKg.min, numWeight)
    );

    const numHeight = Number(heightCm);
    if (!Number.isFinite(numHeight)) {
      return res.status(400).json({ error: 'Valid heightCm is required' });
    }
    const clampedHeight = Math.min(
      PROFILE_LIMITS.heightCm.max,
      Math.max(PROFILE_LIMITS.heightCm.min, numHeight)
    );

    if (!birthDate) {
      return res.status(400).json({ error: 'birthDate is required' });
    }
    const parsedBirthDate = new Date(birthDate);
    if (Number.isNaN(parsedBirthDate.getTime())) {
      return res.status(400).json({ error: 'Invalid birthDate format' });
    }

    const age = calculateAge(parsedBirthDate);
    if (age < PROFILE_LIMITS.age.min || age > PROFILE_LIMITS.age.max) {
      return res.status(400).json({
        error: `Age must be between ${PROFILE_LIMITS.age.min} and ${PROFILE_LIMITS.age.max} (calculated age: ${age})`,
      });
    }

    const updateSet = {
      userId,
      sex,
      heightCm: Math.round(clampedHeight * 10) / 10,
      weightKg: Math.round(clampedWeight * 10) / 10,
      birthDate: parsedBirthDate,
      activityLevel,
      goal,
    };

    const updateUnset = {};

    if (bodyFatPercent !== undefined && bodyFatPercent !== null && bodyFatPercent !== '') {
      const numBfp = Number(bodyFatPercent);
      if (Number.isFinite(numBfp)) {
        updateSet.bodyFatPercent = Math.min(
          PROFILE_LIMITS.bodyFatPercent.max,
          Math.max(PROFILE_LIMITS.bodyFatPercent.min, Math.round(numBfp * 10) / 10)
        );
      }
    } else {
      updateUnset.bodyFatPercent = 1;
    }

    if (maintenanceOverride !== undefined && maintenanceOverride !== null && maintenanceOverride !== '') {
      const numMaint = Number(maintenanceOverride);
      if (Number.isFinite(numMaint) && numMaint > 0) {
        updateSet.maintenanceOverride = Math.round(numMaint);
      }
    } else {
      updateUnset.maintenanceOverride = 1;
    }

    if (proteinPerKg !== undefined && proteinPerKg !== null && proteinPerKg !== '') {
      const numProtein = Number(proteinPerKg);
      if (Number.isFinite(numProtein) && numProtein > 0) {
        updateSet.proteinPerKg = Math.round(numProtein * 100) / 100;
      }
    } else {
      updateUnset.proteinPerKg = 1;
    }

    const updateOp = { $set: updateSet };
    if (Object.keys(updateUnset).length > 0) {
      updateOp.$unset = updateUnset;
    }

    const updatedProfile = await UserProfile.findOneAndUpdate(
      { userId },
      updateOp,
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.json(updatedProfile);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getProfile,
  upsertProfile,
};
