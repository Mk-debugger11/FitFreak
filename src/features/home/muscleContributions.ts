import type { MuscleId } from '../../constants/muscles';
import type { CompletedWorkout, ExerciseMetadata } from '../../types';
import { isWithin } from '../../utils/date';
import { resolveExerciseMuscles } from '../../utils/exercise';
import { computeRirEffortFactor } from './effortCalculator';
import {
  DEFAULT_SCORING_CONFIG,
  type MuscleRole,
  type ScoringConfig,
} from './scoringConfig';
import { partitionWorkoutSets } from './setPartitioner';

/** Inclusive `[start, end]` date range used to filter workouts. */
export interface DateRange {
  start: Date;
  end: Date;
}

/** Per-exercise contribution breakdown attached to a worked muscle entry. */
export interface MuscleExerciseContribution {
  name: string;
  sets: number;
  warmupSets: number;
  role: MuscleRole;
}

/**
 * Raw un-capped per-band set counts and effort-weighted stimulus totals
 * accumulated for a single muscle across the selected date window.
 */
export interface RawMuscleBandTotals {
  sets: number;
  warmupSets: number;
  primarySets: number;
  secondarySets: number;
  stabilizerSets: number;
  directLoad: number;
  rawSecondaryLoad: number;
  rawStabilizerLoad: number;
  rawWeightedSets: number;
  exercises: MuscleExerciseContribution[];
}

/** Output returned by {@link collectMuscleContributions}. */
export interface MuscleContributionsResult {
  muscles: Partial<Record<MuscleId, RawMuscleBandTotals>>;
  totals: {
    workouts: number;
    sets: number;
    warmupSets: number;
  };
  unmapped: number;
}

const createEmptyBandTotals = (): RawMuscleBandTotals => ({
  sets: 0,
  warmupSets: 0,
  primarySets: 0,
  secondarySets: 0,
  stabilizerSets: 0,
  directLoad: 0,
  rawSecondaryLoad: 0,
  rawStabilizerLoad: 0,
  rawWeightedSets: 0,
  exercises: [],
});

const recordBandContribution = (
  muscles: Partial<Record<MuscleId, RawMuscleBandTotals>>,
  muscleId: MuscleId,
  exerciseName: string,
  workingSetCount: number,
  warmupSetCount: number,
  workingEffortSum: number,
  role: MuscleRole,
  roleWeight: number,
): void => {
  const entry = muscles[muscleId] ?? (muscles[muscleId] = createEmptyBandTotals());

  entry.sets += workingSetCount;
  entry.warmupSets += warmupSetCount;

  const weightedEffort = workingEffortSum * roleWeight;
  entry.rawWeightedSets += weightedEffort;

  if (role === 'primary') {
    entry.primarySets += workingSetCount;
    entry.directLoad += weightedEffort;
  } else if (role === 'secondary') {
    entry.secondarySets += workingSetCount;
    entry.rawSecondaryLoad += weightedEffort;
  } else {
    entry.stabilizerSets += workingSetCount;
    entry.rawStabilizerLoad += weightedEffort;
  }

  const existing = entry.exercises.find(
    (item) => item.name === exerciseName && item.role === role,
  );
  if (existing) {
    existing.sets += workingSetCount;
    existing.warmupSets += warmupSetCount;
  } else {
    entry.exercises.push({
      name: exerciseName,
      sets: workingSetCount,
      warmupSets: warmupSetCount,
      role,
    });
  }
};

/**
 * Collects per-muscle working/warm-up set counts and effort-weighted band loads
 * from completed workouts inside `[range.start, range.end]`.
 */
export const collectMuscleContributions = (
  workouts: readonly CompletedWorkout[],
  range: DateRange,
  extraCatalog?: readonly ExerciseMetadata[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): MuscleContributionsResult => {
  const muscles: Partial<Record<MuscleId, RawMuscleBandTotals>> = {};
  const totals = { workouts: 0, sets: 0, warmupSets: 0 };
  let unmapped = 0;

  for (const workout of workouts) {
    if (!isWithin(workout.startTime, range.start, range.end)) continue;

    const nestedSets = workout.workoutData?.sets;
    let workingSetCount = 0;
    let warmupSetCount = 0;
    let workingEffortSum = 0;

    if (nestedSets && nestedSets.length > 0) {
      const partitioned = partitionWorkoutSets(nestedSets, config.warmup);
      workingSetCount = partitioned.workingSets.length;
      warmupSetCount = partitioned.warmupSets.length;
      for (const set of partitioned.workingSets) {
        workingEffortSum += computeRirEffortFactor(set.rir, config.effort);
      }
    } else {
      // Preserve compatibility with legacy/summary workouts lacking nested sets.
      workingSetCount = Number.isFinite(workout.totalSets)
        ? Math.max(0, workout.totalSets)
        : 0;
      warmupSetCount = 0;
      workingEffortSum = workingSetCount * config.effort.neutralFallback;
    }

    if (workingSetCount <= 0 && warmupSetCount <= 0) continue;

    totals.workouts += 1;
    totals.sets += workingSetCount;
    totals.warmupSets += warmupSetCount;

    const targets = resolveExerciseMuscles(
      workout.name,
      workout.category,
      {
        primaryMuscles: workout.primaryMuscles ?? workout.workoutData?.primaryMuscles,
        secondaryMuscles: workout.secondaryMuscles ?? workout.workoutData?.secondaryMuscles,
        stabilizerMuscles: workout.stabilizerMuscles ?? workout.workoutData?.stabilizerMuscles,
      },
      extraCatalog,
    );
    if (!targets) {
      unmapped += 1;
      continue;
    }

    const bands: readonly {
      list: readonly MuscleId[];
      role: MuscleRole;
      weight: number;
    }[] = [
      { list: targets.primary, role: 'primary', weight: config.roleWeights.primary },
      { list: targets.secondary, role: 'secondary', weight: config.roleWeights.secondary },
      { list: targets.stabilizers ?? [], role: 'stabilizer', weight: config.roleWeights.stabilizer },
    ];

    for (const band of bands) {
      for (const muscleId of band.list) {
        recordBandContribution(
          muscles,
          muscleId,
          workout.name,
          workingSetCount,
          warmupSetCount,
          workingEffortSum,
          band.role,
          band.weight,
        );
      }
    }
  }

  return { muscles, totals, unmapped };
};
