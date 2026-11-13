import { WorkoutSet } from '../../types';
import { minutesBetween } from '../../utils/date';

/** Height of the minimized active workout bar in logical pixels. */
export const MINI_BAR_HEIGHT = 64;

/** Vertical upward drag distance (px) required to expand the minimized bar. */
export const SWIPE_UP_DISTANCE = 56;

/** Vertical downward drag distance (px) required to minimize the workout sheet. */
export const SWIPE_DOWN_DISTANCE = 100;

/** Gesture velocity threshold (px/ms) for snapping open or minimizing the sheet. */
export const SWIPE_VELOCITY_THRESHOLD = 0.45;

/** Aggregated set counts and display label for an active workout session. */
export interface WorkoutSetSummary {
  totalCount: number;
  workingCount: number;
  warmupCount: number;
  completedCount: number;
  summaryLabel: string;
}

const formatSetCount = (count: number, singular: string): string =>
  `${count} ${count === 1 ? singular : `${singular}s`}`;

/** Computes working, warm-up, and completed counts plus a clean sentence-case summary label. */
export const summarizeWorkoutSets = (sets: readonly WorkoutSet[]): WorkoutSetSummary => {
  const totalCount = sets.length;
  let warmupCount = 0;
  let completedCount = 0;

  for (const set of sets) {
    if (set.isWarmup === true) {
      warmupCount += 1;
    }
    if (set.completed === true) {
      completedCount += 1;
    }
  }

  const workingCount = totalCount - warmupCount;
  let summaryLabel: string;

  if (totalCount === 0) {
    summaryLabel = 'No sets logged yet';
  } else if (workingCount > 0 && warmupCount > 0) {
    summaryLabel = `${formatSetCount(workingCount, 'working set')}, ${warmupCount} warm-up`;
  } else if (workingCount > 0) {
    summaryLabel = formatSetCount(workingCount, 'working set');
  } else {
    summaryLabel = formatSetCount(warmupCount, 'warm-up set');
  }

  return {
    totalCount,
    workingCount,
    warmupCount,
    completedCount,
    summaryLabel,
  };
};

/** Returns a trimmed workout title, falling back to a category-aware default title. */
export const formatWorkoutTitle = (name?: string, category?: string): string => {
  const trimmed = name?.trim();
  if (trimmed) {
    return trimmed;
  }
  return category === 'Mixed' ? 'Mixed Workout' : 'Ongoing Workout';
};

/** Returns whole elapsed minutes since `startTime`, clamped to `0` for invalid or future dates. */
export const getElapsedMinutes = (startTime: Date | string, now: Date = new Date()): number => {
  const parsed = startTime instanceof Date ? startTime : new Date(startTime);
  if (Number.isNaN(parsed.getTime()) || Number.isNaN(now.getTime())) {
    return 0;
  }
  return Math.max(0, minutesBetween(parsed, now));
};

/** Clamps a sheet Y translation between `0` and `Math.max(0, maxY)`, guarding non-finite inputs. */
export const clampSheetTranslateY = (value: number, maxY: number): number => {
  const upperBound = Number.isFinite(maxY) ? Math.max(0, maxY) : 0;
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), upperBound);
};

/** Returns whether an upward gesture on the mini bar should snap the workout sheet open. */
export const shouldSnapOpenFromMiniBar = (dy: number, vy: number): boolean =>
  dy <= -SWIPE_UP_DISTANCE || vy <= -SWIPE_VELOCITY_THRESHOLD;

/** Returns whether a downward gesture on the workout sheet should minimize it. */
export const shouldMinimizeFromSheet = (dy: number, vy: number): boolean =>
  dy >= SWIPE_DOWN_DISTANCE || vy >= SWIPE_VELOCITY_THRESHOLD;
