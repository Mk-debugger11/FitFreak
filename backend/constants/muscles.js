const defaultCatalog = require('../data/exerciseCatalog.json');

/** Outer-layer muscle identifiers matching the 3D anatomy mesh regions. */
const MUSCLE_IDS = [
  // Front
  'sternocleidomastoid',
  'deltoid_anterior',
  'deltoid_lateral',
  'pectoralis_upper',
  'pectoralis_lower',
  'serratus_anterior',
  'biceps_brachii',
  'brachialis',
  'brachioradialis',
  'forearm_flexors',
  'rectus_abdominis',
  'obliques',
  'quadriceps',
  'adductors',
  'tibialis_anterior',
  // Back
  'trapezius_upper',
  'trapezius_middle',
  'trapezius_lower',
  'deltoid_posterior',
  'infraspinatus',
  'teres_major',
  'latissimus_dorsi',
  'erector_spinae',
  'triceps_brachii',
  'forearm_extensors',
  'gluteus_maximus',
  'gluteus_medius',
  'hamstrings',
  'gastrocnemius',
  'soleus',
  'neck_extensors',
];

const MUSCLE_ID_SET = new Set(MUSCLE_IDS);

/** Supported exercise equipment classifications. */
const EQUIPMENT_TYPES = ['dumbbell', 'barbell', 'machine', 'cable', 'bodyweight'];

/** Fallback primary, secondary, and stabilizer muscle lists keyed by muscle group. */
const GROUP_MUSCLE_FALLBACK = {
  Chest: {
    primary: ['pectoralis_lower', 'pectoralis_upper'],
    secondary: ['deltoid_anterior', 'triceps_brachii'],
    stabilizerMuscles: ['serratus_anterior'],
  },
  Back: {
    primary: ['latissimus_dorsi', 'trapezius_middle', 'trapezius_lower', 'teres_major'],
    secondary: ['erector_spinae', 'deltoid_posterior', 'biceps_brachii'],
    stabilizerMuscles: ['forearm_flexors'],
  },
  Shoulders: {
    primary: ['deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior'],
    secondary: ['trapezius_upper', 'triceps_brachii'],
    stabilizerMuscles: ['infraspinatus', 'serratus_anterior'],
  },
  Biceps: {
    primary: ['biceps_brachii', 'brachialis'],
    secondary: ['brachioradialis'],
    stabilizerMuscles: ['forearm_flexors', 'deltoid_anterior'],
  },
  Triceps: {
    primary: ['triceps_brachii'],
    secondary: ['deltoid_anterior'],
    stabilizerMuscles: ['forearm_flexors', 'forearm_extensors'],
  },
  Forearm: {
    primary: ['forearm_flexors', 'forearm_extensors', 'brachioradialis'],
    secondary: [],
    stabilizerMuscles: [],
  },
  Legs: {
    primary: ['quadriceps', 'hamstrings', 'gluteus_maximus'],
    secondary: ['adductors', 'gluteus_medius', 'gastrocnemius', 'soleus'],
    stabilizerMuscles: ['erector_spinae', 'rectus_abdominis'],
  },
  Abs: {
    primary: ['rectus_abdominis'],
    secondary: ['obliques'],
    stabilizerMuscles: [],
  },
  Core: {
    primary: ['rectus_abdominis', 'obliques'],
    secondary: ['erector_spinae', 'serratus_anterior'],
    stabilizerMuscles: [],
  },
  Neck: {
    primary: ['sternocleidomastoid', 'neck_extensors'],
    secondary: ['trapezius_upper'],
    stabilizerMuscles: [],
  },
  Cardio: {
    primary: [],
    secondary: [],
    stabilizerMuscles: [],
  },
  'Full Body': {
    primary: [],
    secondary: [...MUSCLE_IDS],
    stabilizerMuscles: [],
  },
};

/** Legacy category name aliases mapped to canonical muscle group names. */
const LEGACY_CATEGORY_ALIASES = {
  Forearms: 'Forearm',
  'Abs/Core': 'Core',
};

/** Normalizes an exercise name for case-, punctuation-, and separator-insensitive matching. */
const normalizeExerciseName = (name) => {
  if (typeof name !== 'string') return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
};

/** Filters and deduplicates a list of muscle IDs against MUSCLE_IDS and an optional exclusion set. */
const sanitizeMuscleList = (list, excludeSet) => {
  if (!Array.isArray(list)) return [];
  const excluded =
    excludeSet instanceof Set
      ? excludeSet
      : Array.isArray(excludeSet)
        ? new Set(excludeSet)
        : null;
  const seen = new Set();
  const sanitized = [];

  for (const item of list) {
    if (typeof item !== 'string') continue;
    const muscleId = item.trim();
    if (!MUSCLE_ID_SET.has(muscleId)) continue;
    if (excluded && excluded.has(muscleId)) continue;
    if (seen.has(muscleId)) continue;
    seen.add(muscleId);
    sanitized.push(muscleId);
  }

  return sanitized;
};

const findCatalogMatch = (catalog, targetNorm) => {
  if (!targetNorm || !Array.isArray(catalog) || catalog.length === 0) return null;

  const exactMatch = catalog.find(
    (entry) => entry && (entry.normalizedName || normalizeExerciseName(entry.name)) === targetNorm
  );
  if (exactMatch) return exactMatch;

  return (
    catalog.find(
      (entry) =>
        entry &&
        Array.isArray(entry.aliases) &&
        entry.aliases.some((alias) => normalizeExerciseName(alias) === targetNorm)
    ) || null
  );
};

const resolveCategoryFallback = (category) => {
  if (typeof category !== 'string' || !category.trim()) return null;
  const trimmed = category.trim();

  const directAlias = LEGACY_CATEGORY_ALIASES[trimmed] || trimmed;
  if (GROUP_MUSCLE_FALLBACK[directAlias]) {
    return GROUP_MUSCLE_FALLBACK[directAlias];
  }

  const lower = trimmed.toLowerCase();
  const aliasEntry = Object.entries(LEGACY_CATEGORY_ALIASES).find(
    ([key]) => key.toLowerCase() === lower
  );
  const resolvedName = aliasEntry ? aliasEntry[1] : trimmed;
  const groupKey = Object.keys(GROUP_MUSCLE_FALLBACK).find(
    (key) => key.toLowerCase() === resolvedName.toLowerCase()
  );

  return groupKey ? GROUP_MUSCLE_FALLBACK[groupKey] : null;
};

/**
 * Sanitizes primary, secondary, and stabilizer muscle lists while enforcing
 * deduplication and strict disjointness (primary > secondary > stabilizer).
 */
const sanitizeMuscleTargets = ({
  primaryMuscles,
  secondaryMuscles,
  stabilizerMuscles,
} = {}) => {
  const cleanPrimary = sanitizeMuscleList(primaryMuscles);
  const cleanSecondary = sanitizeMuscleList(secondaryMuscles, new Set(cleanPrimary));
  const cleanStabilizer = sanitizeMuscleList(
    stabilizerMuscles,
    new Set([...cleanPrimary, ...cleanSecondary])
  );
  return {
    primaryMuscles: cleanPrimary,
    secondaryMuscles: cleanSecondary,
    stabilizerMuscles: cleanStabilizer,
  };
};

/**
 * Resolves sanitized, strictly disjoint primaryMuscles, secondaryMuscles, and
 * stabilizerMuscles using explicit values (omitted stabilizerMuscles defaults to []),
 * catalog lookup (canonical name or alias), or muscle-group fallback.
 */
const resolveTargetsForExercise = (exerciseInput = {}, catalog = defaultCatalog) => {
  const {
    name,
    category,
    muscleGroup,
    primaryMuscles,
    secondaryMuscles,
    stabilizerMuscles,
  } = exerciseInput || {};

  const explicit = sanitizeMuscleTargets({
    primaryMuscles,
    secondaryMuscles,
    stabilizerMuscles,
  });

  if (
    explicit.primaryMuscles.length > 0 ||
    explicit.secondaryMuscles.length > 0 ||
    explicit.stabilizerMuscles.length > 0
  ) {
    return explicit;
  }

  const targetNorm = normalizeExerciseName(name);
  const catalogMatch = findCatalogMatch(catalog, targetNorm);
  if (catalogMatch) {
    return sanitizeMuscleTargets({
      primaryMuscles: catalogMatch.primaryMuscles,
      secondaryMuscles: catalogMatch.secondaryMuscles,
      stabilizerMuscles: catalogMatch.stabilizerMuscles,
    });
  }

  const fallback = resolveCategoryFallback(category ?? muscleGroup);
  if (fallback) {
    return sanitizeMuscleTargets({
      primaryMuscles: fallback.primary,
      secondaryMuscles: fallback.secondary,
      stabilizerMuscles: fallback.stabilizerMuscles ?? fallback.stabilizer,
    });
  }

  return {
    primaryMuscles: [],
    secondaryMuscles: [],
    stabilizerMuscles: [],
  };
};

module.exports = {
  MUSCLE_IDS,
  EQUIPMENT_TYPES,
  GROUP_MUSCLE_FALLBACK,
  LEGACY_CATEGORY_ALIASES,
  normalizeExerciseName,
  sanitizeMuscleList,
  sanitizeMuscleTargets,
  resolveTargetsForExercise,
};
