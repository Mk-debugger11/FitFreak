import type { MuscleId } from '../../constants/muscles';

/** Time window supported by the muscle scoring engine. */
export type ActivityPeriod = 'daily' | 'weekly';

/** Anatomical involvement tier of a muscle in a given exercise. */
export type MuscleRole = 'primary' | 'secondary' | 'stabilizer';

/**
 * Configurable app heuristic multipliers applied per working set by role.
 * Inspired by fractional set-counting conventions, not universal biological constants.
 */
export interface RoleWeights {
  readonly primary: number;
  readonly secondary: number;
  readonly stabilizer: number;
}

/**
 * Configurable app heuristic bounds preventing indirect stabilizer or synergist
 * volume from exaggerating effective stimulus when direct work is absent.
 */
export interface ScoringCaps {
  readonly stabilizerMaxEffective: Readonly<Record<ActivityPeriod, number>>;
  readonly stabilizerScale: Readonly<Record<ActivityPeriod, number>>;
  readonly indirectOnlyCeiling: Readonly<Record<ActivityPeriod, number>>;
}

/**
 * Configurable app heuristic thresholds used to conservatively separate
 * ascending warm-up/feeder sets from working sets when chronology is verified.
 */
export interface WarmupConfig {
  readonly autoWeightRatioCutoff: number;
  readonly feederWeightRatioCutoff: number;
  readonly feederE1RMRatioCutoff: number;
}

/**
 * Configurable app heuristic curve scaling per-set stimulus by proximity to failure (RIR).
 * Inspired by hypertrophy effort-dose concepts; defaults preserve neutral `1.0` weighting
 * when RIR is omitted.
 */
export interface EffortConfig {
  readonly enabled: boolean;
  readonly neutralFallback: number;
  readonly minRir: number;
  readonly maxRir: number;
  readonly fullEffortMaxRir: number;
  readonly decayPerRirAboveFull: number;
  readonly minMultiplier: number;
  readonly maxMultiplier: number;
}

/** Configurable app heuristic cutoffs for single-day effective load zones. */
export interface DailyZoneThresholds {
  readonly starterMax: number;
  readonly effectiveMax: number;
  readonly optimalMax: number;
  readonly highVolumeMax: number;
}

/** Configurable app heuristic cutoffs for weekly effective load zones. */
export interface WeeklyZoneThresholds {
  readonly maintenanceMax: number;
  readonly mevMax: number;
  readonly mavMax: number;
}

/** Optional per-muscle overrides over global configurable heuristic thresholds. */
export interface MuscleThresholdOverride {
  readonly dailyZones: Partial<DailyZoneThresholds>;
  readonly weeklyZones: Partial<WeeklyZoneThresholds>;
  readonly periodHeatmapHigh: Partial<Record<ActivityPeriod, number>>;
  readonly stimulusTau: Partial<Record<ActivityPeriod, number>>;
}

/** Normalized `[0, 1]` heatmap stop paired with a `#RRGGBB` color string. */
export interface HeatColorStop {
  readonly stop: number;
  readonly color: string;
}

/**
 * Pure-TS anatomy heat palette defaults matching `theme.colors.anatomy`
 * so the scoring engine executes in Node tests without React Native dependencies.
 */
export const ANATOMY_HEAT_PALETTE = {
  none: '#545966',
  light: '#7A3820',
  moderate: '#C43E12',
  high: '#FF4500',
} as const;

/**
 * Complete configuration object for the pure muscle scoring engine.
 * All weights, saturation constants, caps, and volume zones are configurable
 * app heuristics designed for clear training feedback rather than clinical claims.
 */
export interface ScoringConfig {
  readonly roleWeights: RoleWeights;
  readonly periodHeatmapHigh: Readonly<Record<ActivityPeriod, number>>;
  readonly stimulusTau: Readonly<Record<ActivityPeriod, number>>;
  readonly caps: ScoringCaps;
  readonly warmup: WarmupConfig;
  readonly effort: EffortConfig;
  readonly dailyZones: DailyZoneThresholds;
  readonly weeklyZones: WeeklyZoneThresholds;
  readonly muscleThresholds?: Partial<Record<MuscleId, Partial<MuscleThresholdOverride>>>;
  readonly heatStops: readonly HeatColorStop[];
}

/**
 * Default configurable app heuristics for FitFreak Phase 2 scoring.
 * Inspired by resistance-training volume-landmark and proximity-to-failure concepts,
 * calibrated to provide intuitive daily and weekly body-map feedback.
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  roleWeights: {
    primary: 1.0,
    secondary: 0.5,
    stabilizer: 0.15,
  },
  periodHeatmapHigh: {
    daily: 3.0,
    weekly: 10.0,
  },
  stimulusTau: {
    daily: 3.5,
    weekly: 8.0,
  },
  caps: {
    stabilizerMaxEffective: {
      daily: 0.50,
      weekly: 1.67,
    },
    stabilizerScale: {
      daily: 0.54,
      weekly: 1.80,
    },
    indirectOnlyCeiling: {
      daily: 1.80,
      weekly: 6.00,
    },
  },
  warmup: {
    autoWeightRatioCutoff: 0.65,
    feederWeightRatioCutoff: 0.78,
    feederE1RMRatioCutoff: 0.74,
  },
  effort: {
    enabled: true,
    neutralFallback: 1.0,
    minRir: 0,
    maxRir: 10,
    fullEffortMaxRir: 3,
    decayPerRirAboveFull: 0.15,
    minMultiplier: 0.25,
    maxMultiplier: 1.0,
  },
  dailyZones: {
    starterMax: 1.5,
    effectiveMax: 3.0,
    optimalMax: 6.0,
    highVolumeMax: 10.0,
  },
  weeklyZones: {
    maintenanceMax: 4.0,
    mevMax: 10.0,
    mavMax: 20.0,
  },
  heatStops: [
    { stop: 0.0, color: ANATOMY_HEAT_PALETTE.none },
    { stop: 0.33, color: ANATOMY_HEAT_PALETTE.light },
    { stop: 0.69, color: ANATOMY_HEAT_PALETTE.moderate },
    { stop: 1.0, color: ANATOMY_HEAT_PALETTE.high },
  ],
};
