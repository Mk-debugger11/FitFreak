import type { MuscleGroup } from './exercises';

/**
 * Outer-layer muscle identifiers matching the `<muscleId>_l` / `<muscleId>_r`
 * mesh names in `assets/models/body.glb`.
 */
export const MUSCLE_IDS = [
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
] as const;

export type MuscleId = (typeof MUSCLE_IDS)[number];

/** Lookup set for validating muscle identifiers at runtime. */
export const MUSCLE_ID_SET: ReadonlySet<string> = new Set(MUSCLE_IDS);

/** Narrows an unknown value to a known `MuscleId`. */
export const isMuscleId = (value: unknown): value is MuscleId =>
  typeof value === 'string' && MUSCLE_ID_SET.has(value);

/** Filters unknown values down to unique, valid `MuscleId`s, omitting any in `excluded`. */
export const filterMuscleIds = (
  values: readonly unknown[] | undefined,
  excluded?: ReadonlySet<MuscleId>,
): MuscleId[] => {
  if (!values || values.length === 0) return [];
  const seen = new Set<MuscleId>(excluded);
  const result: MuscleId[] = [];
  for (const value of values) {
    if (isMuscleId(value) && !seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
};

/** Human-readable muscle names displayed in the anatomy sheet. */
export const MUSCLE_LABELS: Record<MuscleId, string> = {
  sternocleidomastoid: 'Front Neck',
  deltoid_anterior: 'Front Delts',
  deltoid_lateral: 'Side Delts',
  pectoralis_upper: 'Upper Chest',
  pectoralis_lower: 'Lower Chest',
  serratus_anterior: 'Serratus',
  biceps_brachii: 'Biceps',
  brachialis: 'Brachialis',
  brachioradialis: 'Brachioradialis',
  forearm_flexors: 'Forearm Flexors',
  rectus_abdominis: 'Abs',
  obliques: 'Obliques',
  quadriceps: 'Quadriceps',
  adductors: 'Adductors',
  tibialis_anterior: 'Tibialis',
  trapezius_upper: 'Upper Traps',
  trapezius_middle: 'Middle Traps',
  trapezius_lower: 'Lower Traps',
  deltoid_posterior: 'Rear Delts',
  infraspinatus: 'Infraspinatus',
  teres_major: 'Teres Major',
  latissimus_dorsi: 'Lats',
  erector_spinae: 'Lower Back',
  triceps_brachii: 'Triceps',
  forearm_extensors: 'Forearm Extensors',
  gluteus_maximus: 'Glutes',
  gluteus_medius: 'Glute Medius',
  hamstrings: 'Hamstrings',
  gastrocnemius: 'Calves',
  soleus: 'Soleus',
  neck_extensors: 'Back Neck',
};

/** Disjoint muscle bands targeted by an exercise or category fallback. */
export interface MuscleTargets {
  primary: readonly MuscleId[];
  secondary: readonly MuscleId[];
  stabilizers: readonly MuscleId[];
}

/**
 * Fallback muscle mapping per category when a logged exercise isn't in the
 * built-in catalogue (custom exercises, renamed movements, etc.).
 * Every group keeps `primary`, `secondary`, and `stabilizers` strictly disjoint.
 */
export const GROUP_MUSCLE_FALLBACK: Record<MuscleGroup, MuscleTargets> = {
  Chest: {
    primary: ['pectoralis_lower', 'pectoralis_upper'],
    secondary: ['deltoid_anterior', 'triceps_brachii'],
    stabilizers: ['serratus_anterior'],
  },
  Back: {
    primary: ['latissimus_dorsi', 'trapezius_middle', 'trapezius_lower', 'teres_major'],
    secondary: ['erector_spinae', 'deltoid_posterior', 'biceps_brachii'],
    stabilizers: ['forearm_flexors'],
  },
  Shoulders: {
    primary: ['deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior'],
    secondary: ['trapezius_upper', 'triceps_brachii'],
    stabilizers: ['infraspinatus', 'serratus_anterior'],
  },
  Biceps: {
    primary: ['biceps_brachii', 'brachialis'],
    secondary: ['brachioradialis'],
    stabilizers: ['forearm_flexors', 'deltoid_anterior'],
  },
  Triceps: {
    primary: ['triceps_brachii'],
    secondary: ['deltoid_anterior'],
    stabilizers: ['forearm_flexors', 'forearm_extensors'],
  },
  Forearm: {
    primary: ['forearm_flexors', 'forearm_extensors', 'brachioradialis'],
    secondary: [],
    stabilizers: [],
  },
  Legs: {
    primary: ['quadriceps', 'hamstrings', 'gluteus_maximus'],
    secondary: ['adductors', 'gluteus_medius', 'gastrocnemius', 'soleus'],
    stabilizers: ['erector_spinae', 'rectus_abdominis'],
  },
  Abs: {
    primary: ['rectus_abdominis'],
    secondary: ['obliques'],
    stabilizers: [],
  },
  Core: {
    primary: ['rectus_abdominis', 'obliques'],
    secondary: ['erector_spinae', 'serratus_anterior'],
    stabilizers: [],
  },
  Neck: {
    primary: ['sternocleidomastoid', 'neck_extensors'],
    secondary: ['trapezius_upper'],
    stabilizers: [],
  },
  Cardio: {
    primary: [],
    secondary: [],
    stabilizers: [],
  },
  'Full Body': {
    primary: [],
    secondary: MUSCLE_IDS,
    stabilizers: [],
  },
};

