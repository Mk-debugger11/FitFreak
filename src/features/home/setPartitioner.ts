import type { WorkoutSet } from '../../types';
import { DEFAULT_SCORING_CONFIG, type WarmupConfig } from './scoringConfig';

/** Result of separating completed workout sets into working and warm-up groups. */
export interface PartitionedSetsResult {
  readonly workingSets: readonly WorkoutSet[];
  readonly warmupSets: readonly WorkoutSet[];
  readonly firstWorkingPeakIndex: number | null;
  readonly chronologyVerified: boolean;
}

interface IndexedSet {
  readonly set: WorkoutSet;
  readonly originalIndex: number;
  readonly timestampMs: number;
}

const parseTimestampMs = (value: unknown): number => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return Date.parse(value);
  return Number.NaN;
};

const sanitizeMetric = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

const computeEpley1RM = (weight: number, reps: number): number => {
  const safeWeight = sanitizeMetric(weight);
  const safeReps = sanitizeMetric(reps);
  return safeWeight > 0 && safeReps > 0 ? safeWeight * (1 + safeReps / 30) : safeReps;
};

/**
 * Partitions completed sets into working and warm-up sets without mutating input.
 * Explicit `isWarmup` flags are always honored; untagged sets are only auto-classified
 * as warm-ups when set chronology is verified and they precede the first working peak.
 */
export const partitionWorkoutSets = (
  sets: readonly WorkoutSet[] | undefined,
  config: WarmupConfig = DEFAULT_SCORING_CONFIG.warmup,
): PartitionedSetsResult => {
  if (!sets || sets.length === 0) {
    return {
      workingSets: [],
      warmupSets: [],
      firstWorkingPeakIndex: null,
      chronologyVerified: false,
    };
  }

  const completed: IndexedSet[] = [];
  const timestamps = new Set<number>();
  let allTimestampsValid = true;

  for (let originalIndex = 0; originalIndex < sets.length; originalIndex += 1) {
    const set = sets[originalIndex];
    if (set.completed === false) continue;

    const timestampMs = parseTimestampMs(set.createdAt);
    if (Number.isNaN(timestampMs)) {
      allTimestampsValid = false;
    } else {
      timestamps.add(timestampMs);
    }

    completed.push({ set, originalIndex, timestampMs });
  }

  if (completed.length === 0) {
    return {
      workingSets: [],
      warmupSets: [],
      firstWorkingPeakIndex: null,
      chronologyVerified: false,
    };
  }

  const chronologyVerified =
    allTimestampsValid && timestamps.size === completed.length;

  const ordered = chronologyVerified
    ? [...completed].sort(
        (a, b) => a.timestampMs - b.timestampMs || a.originalIndex - b.originalIndex,
      )
    : completed;

  let peakWeight = 0;
  let peak1RM = 0;
  for (const { set } of ordered) {
    if (set.isWarmup === true) continue;
    const weight = sanitizeMetric(set.weight);
    const e1rm = computeEpley1RM(set.weight, set.reps);
    if (weight > peakWeight) peakWeight = weight;
    if (e1rm > peak1RM) peak1RM = e1rm;
  }

  let firstExplicitWorkingIndex = Number.POSITIVE_INFINITY;
  let firstHeavyAnchorIndex = Number.POSITIVE_INFINITY;

  for (let i = 0; i < ordered.length; i += 1) {
    const { set } = ordered[i];
    if (set.isWarmup === false && firstExplicitWorkingIndex === Number.POSITIVE_INFINITY) {
      firstExplicitWorkingIndex = i;
    } else if (
      typeof set.isWarmup !== 'boolean' &&
      firstHeavyAnchorIndex === Number.POSITIVE_INFINITY
    ) {
      const weight = sanitizeMetric(set.weight);
      const e1rm = computeEpley1RM(set.weight, set.reps);
      const isHeavyAnchor =
        peakWeight === 0 ||
        weight >= peakWeight * config.feederWeightRatioCutoff ||
        e1rm >= peak1RM * config.feederE1RMRatioCutoff;

      if (isHeavyAnchor) {
        firstHeavyAnchorIndex = i;
      }
    }
  }

  const minWorkingIndex = Math.min(firstExplicitWorkingIndex, firstHeavyAnchorIndex);
  const firstWorkingPeakIndex = Number.isFinite(minWorkingIndex) ? minWorkingIndex : null;

  const workingSets: WorkoutSet[] = [];
  const warmupSets: WorkoutSet[] = [];

  for (let i = 0; i < ordered.length; i += 1) {
    const { set } = ordered[i];

    if (set.isWarmup === true) {
      warmupSets.push(set);
      continue;
    }

    if (set.isWarmup === false) {
      workingSets.push(set);
      continue;
    }

    const weight = sanitizeMetric(set.weight);
    const e1rm = computeEpley1RM(set.weight, set.reps);
    const isAutoWarmup =
      chronologyVerified &&
      firstWorkingPeakIndex !== null &&
      i < firstWorkingPeakIndex &&
      peakWeight > 0 &&
      (weight < peakWeight * config.autoWeightRatioCutoff ||
        (weight < peakWeight * config.feederWeightRatioCutoff &&
          e1rm < peak1RM * config.feederE1RMRatioCutoff));

    if (isAutoWarmup) {
      warmupSets.push(set);
    } else {
      workingSets.push(set);
    }
  }

  return {
    workingSets,
    warmupSets,
    firstWorkingPeakIndex,
    chronologyVerified,
  };
};
