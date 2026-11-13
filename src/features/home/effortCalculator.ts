import { DEFAULT_SCORING_CONFIG, type EffortConfig } from './scoringConfig';

/**
 * Computes the configurable RIR-based effort multiplier for a single working set.
 * Returns `config.neutralFallback` when RIR is disabled or omitted/non-finite.
 */
export const computeRirEffortFactor = (
  rir?: number | null,
  config: EffortConfig = DEFAULT_SCORING_CONFIG.effort,
): number => {
  if (!config.enabled || rir === undefined || rir === null || !Number.isFinite(rir)) {
    return config.neutralFallback;
  }

  const clampedRir = Math.min(config.maxRir, Math.max(config.minRir, rir));
  const excessRir = Math.max(0, clampedRir - config.fullEffortMaxRir);
  const rawMultiplier = config.maxMultiplier - excessRir * config.decayPerRirAboveFull;

  return Math.min(config.maxMultiplier, Math.max(config.minMultiplier, rawMultiplier));
};
