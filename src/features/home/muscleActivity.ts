import type { MuscleId } from '../../constants/muscles';
import type { CompletedWorkout, ExerciseMetadata } from '../../types';
import {
  type ActivityLevel,
  type VolumeZone,
  classifyVolumeZone,
  computeEffectiveLoad,
  computeHeatmapIntensity,
  computeStimulusSaturationPct,
  getActivityLevelFromEffectiveLoad,
  interpolateHeatColor,
} from './doseResponse';
import { computeRirEffortFactor } from './effortCalculator';
import {
  type DateRange,
  type MuscleExerciseContribution,
  type RawMuscleBandTotals,
  collectMuscleContributions,
} from './muscleContributions';
import {
  ANATOMY_HEAT_PALETTE,
  type ActivityPeriod,
  DEFAULT_SCORING_CONFIG,
  type HeatColorStop,
  type MuscleRole,
  type ScoringConfig,
} from './scoringConfig';
import { type PartitionedSetsResult, partitionWorkoutSets } from './setPartitioner';

export {
  ANATOMY_HEAT_PALETTE,
  DEFAULT_SCORING_CONFIG,
  classifyVolumeZone,
  collectMuscleContributions,
  computeEffectiveLoad,
  computeHeatmapIntensity,
  computeRirEffortFactor,
  computeStimulusSaturationPct,
  getActivityLevelFromEffectiveLoad,
  interpolateHeatColor,
  partitionWorkoutSets,
};

export type {
  ActivityLevel,
  ActivityPeriod,
  DateRange,
  HeatColorStop,
  MuscleExerciseContribution,
  MuscleRole,
  PartitionedSetsResult,
  RawMuscleBandTotals,
  ScoringConfig,
  VolumeZone,
};

/** Per-muscle aggregated volume, dose-response metrics, and exercise breakdown. */
export interface MuscleActivityEntry {
  sets: number;
  warmupSets: number;
  primarySets: number;
  secondarySets: number;
  stabilizerSets: number;
  rawWeightedSets: number;
  effectiveLoad: number;
  heatmapIntensity: number;
  stimulusSaturationPct: number;
  volumeZone: VolumeZone;
  /** Rounded effective load retained temporarily for legacy UI component compatibility. */
  score: number;
  level: ActivityLevel;
  exercises: MuscleExerciseContribution[];
}

/** Aggregated muscle activity output for the active date range and period. */
export interface MuscleActivityResult {
  muscles: Partial<Record<MuscleId, MuscleActivityEntry>>;
  totals: {
    workouts: number;
    sets: number;
    warmupSets: number;
  };
  unmapped: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Aggregates completed workouts inside `[range.start, range.end]` into per-muscle
 * working/warm-up sets, effective stimulus load, dose-response metrics, and volume zones.
 */
export const computeMuscleActivity = (
  workouts: readonly CompletedWorkout[],
  range: DateRange,
  period: ActivityPeriod = 'weekly',
  extraCatalog?: readonly ExerciseMetadata[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): MuscleActivityResult => {
  const contributions = collectMuscleContributions(workouts, range, extraCatalog, config);
  const muscles: Partial<Record<MuscleId, MuscleActivityEntry>> = {};

  for (const muscleId of Object.keys(contributions.muscles) as MuscleId[]) {
    const raw = contributions.muscles[muscleId];
    if (!raw) continue;

    const effectiveLoad = computeEffectiveLoad(raw, period, config);
    const heatmapIntensity = computeHeatmapIntensity(effectiveLoad, period, config, muscleId);
    const stimulusSaturationPct = computeStimulusSaturationPct(
      effectiveLoad,
      period,
      config,
      muscleId,
    );
    const volumeZone = classifyVolumeZone(
      effectiveLoad,
      raw.warmupSets,
      period,
      muscleId,
      config,
    );
    const level = getActivityLevelFromEffectiveLoad(effectiveLoad, period, muscleId, config);

    muscles[muscleId] = {
      sets: raw.sets,
      warmupSets: raw.warmupSets,
      primarySets: raw.primarySets,
      secondarySets: raw.secondarySets,
      stabilizerSets: raw.stabilizerSets,
      rawWeightedSets: raw.rawWeightedSets,
      effectiveLoad,
      heatmapIntensity,
      stimulusSaturationPct,
      volumeZone,
      score: round2(effectiveLoad),
      level,
      exercises: raw.exercises,
    };
  }

  return {
    muscles,
    totals: contributions.totals,
    unmapped: contributions.unmapped,
  };
};
