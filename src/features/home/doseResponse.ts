import type { MuscleId } from '../../constants/muscles';
import type { RawMuscleBandTotals } from './muscleContributions';
import {
  type ActivityPeriod,
  type DailyZoneThresholds,
  DEFAULT_SCORING_CONFIG,
  type HeatColorStop,
  type ScoringConfig,
  type WeeklyZoneThresholds,
} from './scoringConfig';

/** Highlight intensity tier used by the 3D body model and legend. */
export type ActivityLevel = 'none' | 'light' | 'moderate' | 'high';

/** Configurable volume zone classification for daily or weekly effective load. */
export type VolumeZone =
  | 'rest'
  | 'warmup_only'
  | 'starter'
  | 'effective'
  | 'optimal'
  | 'high_volume'
  | 'diminishing_returns'
  | 'maintenance'
  | 'mev_building'
  | 'optimal_mav'
  | 'very_high_volume';

const resolveDailyZones = (
  muscleId: MuscleId | undefined,
  config: ScoringConfig,
): DailyZoneThresholds => {
  const override = muscleId ? config.muscleThresholds?.[muscleId]?.dailyZones : undefined;
  return override ? { ...config.dailyZones, ...override } : config.dailyZones;
};

const resolveWeeklyZones = (
  muscleId: MuscleId | undefined,
  config: ScoringConfig,
): WeeklyZoneThresholds => {
  const override = muscleId ? config.muscleThresholds?.[muscleId]?.weeklyZones : undefined;
  return override ? { ...config.weeklyZones, ...override } : config.weeklyZones;
};

/**
 * Authoritative computation of effective muscle stimulus load from raw band totals.
 * Applies exponential saturation to stabilizer load and enforces the indirect-only
 * ceiling whenever a muscle has no direct primary sets.
 */
export const computeEffectiveLoad = (
  bands: Pick<RawMuscleBandTotals, 'directLoad' | 'rawSecondaryLoad' | 'rawStabilizerLoad'>,
  period: ActivityPeriod,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): number => {
  const directLoad = Number.isFinite(bands.directLoad) ? Math.max(0, bands.directLoad) : 0;
  const rawSecondaryLoad = Number.isFinite(bands.rawSecondaryLoad)
    ? Math.max(0, bands.rawSecondaryLoad)
    : 0;
  const rawStabilizerLoad = Number.isFinite(bands.rawStabilizerLoad)
    ? Math.max(0, bands.rawStabilizerLoad)
    : 0;

  const maxStab = config.caps.stabilizerMaxEffective[period];
  const scaleStab = config.caps.stabilizerScale[period];
  const boundedStabilizer =
    rawStabilizerLoad > 0 && scaleStab > 0
      ? maxStab * (1 - Math.exp(-rawStabilizerLoad / scaleStab))
      : 0;

  const combined = directLoad + rawSecondaryLoad + boundedStabilizer;
  if (directLoad > 0) {
    return combined;
  }
  if (rawSecondaryLoad > 0) {
    return Math.min(combined, config.caps.indirectOnlyCeiling[period]);
  }
  return boundedStabilizer;
};

/**
 * Maps effective load to a normalized `[0, 1]` logarithmic heatmap intensity
 * strictly from `effectiveLoad` with no post-caps.
 */
export const computeHeatmapIntensity = (
  effectiveLoad: number,
  period: ActivityPeriod,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
  muscleId?: MuscleId,
): number => {
  if (!Number.isFinite(effectiveLoad) || effectiveLoad <= 0) {
    return 0;
  }
  const highThreshold =
    (muscleId ? config.muscleThresholds?.[muscleId]?.periodHeatmapHigh?.[period] : undefined) ??
    config.periodHeatmapHigh[period];

  if (highThreshold <= 0) {
    return 1;
  }

  return Math.min(1, Math.log1p(4.5 * (effectiveLoad / highThreshold)) / Math.log(5.5));
};

/**
 * Computes an integer `[0, 100]` stimulus saturation percentage strictly from
 * `effectiveLoad` using an exponential dose-response curve.
 */
export const computeStimulusSaturationPct = (
  effectiveLoad: number,
  period: ActivityPeriod,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
  muscleId?: MuscleId,
): number => {
  if (!Number.isFinite(effectiveLoad) || effectiveLoad <= 0) {
    return 0;
  }
  const tau =
    (muscleId ? config.muscleThresholds?.[muscleId]?.stimulusTau?.[period] : undefined) ??
    config.stimulusTau[period];

  if (tau <= 0) {
    return 100;
  }

  return Math.round(100 * (1 - Math.exp(-effectiveLoad / tau)));
};

/**
 * Classifies effective load and warm-up counts into a period-appropriate volume zone,
 * honoring optional per-muscle threshold overrides.
 */
export const classifyVolumeZone = (
  effectiveLoad: number,
  warmupSets: number,
  period: ActivityPeriod,
  muscleId?: MuscleId,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): VolumeZone => {
  if (!Number.isFinite(effectiveLoad) || effectiveLoad <= 0) {
    return warmupSets > 0 ? 'warmup_only' : 'rest';
  }

  if (period === 'daily') {
    const zones = resolveDailyZones(muscleId, config);
    if (effectiveLoad < zones.starterMax) return 'starter';
    if (effectiveLoad < zones.effectiveMax) return 'effective';
    if (effectiveLoad < zones.optimalMax) return 'optimal';
    if (effectiveLoad <= zones.highVolumeMax) return 'high_volume';
    return 'diminishing_returns';
  }

  const zones = resolveWeeklyZones(muscleId, config);
  if (effectiveLoad < zones.maintenanceMax) return 'maintenance';
  if (effectiveLoad < zones.mevMax) return 'mev_building';
  if (effectiveLoad <= zones.mavMax) return 'optimal_mav';
  return 'very_high_volume';
};

/**
 * Maps effective load to a four-tier {@link ActivityLevel} consistent with the
 * period's configurable volume zone boundaries.
 */
export const getActivityLevelFromEffectiveLoad = (
  effectiveLoad: number,
  period: ActivityPeriod,
  muscleId?: MuscleId,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): ActivityLevel => {
  if (!Number.isFinite(effectiveLoad) || effectiveLoad <= 0) {
    return 'none';
  }

  if (period === 'daily') {
    const zones = resolveDailyZones(muscleId, config);
    if (effectiveLoad < zones.starterMax) return 'light';
    if (effectiveLoad < zones.effectiveMax) return 'moderate';
    return 'high';
  }

  const zones = resolveWeeklyZones(muscleId, config);
  if (effectiveLoad < zones.maintenanceMax) return 'light';
  if (effectiveLoad < zones.mevMax) return 'moderate';
  return 'high';
};

const parseHexRgb = (hex: string): [number, number, number] => {
  const clean = hex.trim().replace(/^#/, '');
  const toByte = (segment: string): number => {
    const parsed = Number.parseInt(segment, 16);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  if (clean.length === 3) {
    return [
      toByte(clean[0] + clean[0]),
      toByte(clean[1] + clean[1]),
      toByte(clean[2] + clean[2]),
    ];
  }
  if (clean.length === 6) {
    return [
      toByte(clean.slice(0, 2)),
      toByte(clean.slice(2, 4)),
      toByte(clean.slice(4, 6)),
    ];
  }
  return [0, 0, 0];
};

const formatHexRgb = (r: number, g: number, b: number): string => {
  const toHex = (channel: number): string =>
    Math.min(255, Math.max(0, Math.round(channel)))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * Smoothly interpolates an RGB hex color across ordered heatmap stops for a
 * normalized `intensity` in `[0, 1]`.
 */
export const interpolateHeatColor = (
  intensity: number,
  stops: readonly HeatColorStop[] = DEFAULT_SCORING_CONFIG.heatStops,
): string => {
  const activeStops = stops.length > 0 ? stops : DEFAULT_SCORING_CONFIG.heatStops;
  const sorted = [...activeStops].sort((a, b) => a.stop - b.stop);
  const clamped = Number.isFinite(intensity) ? Math.min(1, Math.max(0, intensity)) : 0;

  if (clamped <= sorted[0].stop) {
    return formatHexRgb(...parseHexRgb(sorted[0].color));
  }

  const last = sorted[sorted.length - 1];
  if (clamped >= last.stop) {
    return formatHexRgb(...parseHexRgb(last.color));
  }

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const lower = sorted[i];
    const upper = sorted[i + 1];
    if (clamped <= upper.stop) {
      const span = upper.stop - lower.stop;
      const t = span > 0 ? (clamped - lower.stop) / span : 0;
      const [r1, g1, b1] = parseHexRgb(lower.color);
      const [r2, g2, b2] = parseHexRgb(upper.color);
      return formatHexRgb(
        r1 + (r2 - r1) * t,
        g1 + (g2 - g1) * t,
        b1 + (b2 - b1) * t,
      );
    }
  }

  return formatHexRgb(...parseHexRgb(last.color));
};
