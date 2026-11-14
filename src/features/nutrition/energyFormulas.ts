import type {
  MacroNutrients,
  Sex,
  UserProfile,
} from '../../types';
import {
  ACTIVITY_MULTIPLIERS,
  DEFAULT_FAT_CALORIE_SHARE,
  DEFAULT_PROTEIN_PER_KG,
  GOAL_ADJUSTMENTS,
} from '../../constants/nutrition';
import { ageFromBirthDate } from '../../utils/date';

/**
 * Authoritative input limits for body measurements and age.
 * Shared between energy calculation maths and UI profile forms.
 */
export const PROFILE_LIMITS = {
  weightKg: { min: 25, max: 300 },
  heightCm: { min: 100, max: 250 },
  age: { min: 13, max: 100 },
  bodyFatPercent: { min: 3, max: 60 },
} as const;

export type BmrFormula = 'mifflin_st_jeor' | 'katch_mcardle';

export interface BmrResult {
  kcal: number;
  formula: BmrFormula;
}

export interface MaintenanceResult {
  kcal: number;
  bmr: number;
  multiplier: number;
  formula: 'mifflin_st_jeor' | 'katch_mcardle' | 'override';
  isOverride: boolean;
}

/**
 * Mifflin-St Jeor equation for Basal Metabolic Rate (BMR).
 * male: 10*weightKg + 6.25*heightCm - 5*ageYears + 5
 * female: 10*weightKg + 6.25*heightCm - 5*ageYears - 161
 */
export function mifflinStJeorBmr({
  sex,
  weightKg,
  heightCm,
  ageYears,
}: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === 'male' ? base + 5 : base - 161;
}

/**
 * Katch-McArdle equation for BMR based on lean body mass.
 * leanMass = weightKg * (1 - bodyFatPercent / 100)
 * bmr = 370 + 21.6 * leanMass
 */
export function katchMcArdleBmr({
  weightKg,
  bodyFatPercent,
}: {
  weightKg: number;
  bodyFatPercent: number;
}): number {
  const leanMass = weightKg * (1 - bodyFatPercent / 100);
  return 370 + 21.6 * leanMass;
}

/**
 * Compute Basal Metabolic Rate (BMR) from a user profile.
 * - Uses Katch-McArdle when bodyFatPercent is within PROFILE_LIMITS.bodyFatPercent (3-60).
 * - Otherwise falls back to Mifflin-St Jeor.
 * - Derives age via ageFromBirthDate(profile.birthDate).
 * - Returns null if profile is missing/null/undefined or any required field is missing or out of PROFILE_LIMITS.
 */
export function computeBmr(
  profile: Partial<UserProfile> | null | undefined,
): BmrResult | null {
  if (!profile) return null;

  const { sex, heightCm, weightKg, birthDate, bodyFatPercent } = profile;

  if (sex !== 'male' && sex !== 'female') return null;

  if (
    typeof weightKg !== 'number' ||
    Number.isNaN(weightKg) ||
    weightKg < PROFILE_LIMITS.weightKg.min ||
    weightKg > PROFILE_LIMITS.weightKg.max
  ) {
    return null;
  }

  if (
    typeof heightCm !== 'number' ||
    Number.isNaN(heightCm) ||
    heightCm < PROFILE_LIMITS.heightCm.min ||
    heightCm > PROFILE_LIMITS.heightCm.max
  ) {
    return null;
  }

  if (!birthDate) return null;
  const dateObj =
    birthDate instanceof Date
      ? birthDate
      : typeof birthDate === 'string'
        ? new Date(birthDate)
        : null;

  if (!dateObj || Number.isNaN(dateObj.getTime())) return null;

  const age = ageFromBirthDate(dateObj);
  if (
    typeof age !== 'number' ||
    Number.isNaN(age) ||
    age < PROFILE_LIMITS.age.min ||
    age > PROFILE_LIMITS.age.max
  ) {
    return null;
  }

  // Use Katch-McArdle if bodyFatPercent is within valid limits
  if (
    typeof bodyFatPercent === 'number' &&
    !Number.isNaN(bodyFatPercent) &&
    bodyFatPercent >= PROFILE_LIMITS.bodyFatPercent.min &&
    bodyFatPercent <= PROFILE_LIMITS.bodyFatPercent.max
  ) {
    const rawBmr = katchMcArdleBmr({ weightKg, bodyFatPercent });
    return {
      kcal: Math.round(rawBmr),
      formula: 'katch_mcardle',
    };
  }

  // Otherwise fallback to Mifflin-St Jeor
  const rawBmr = mifflinStJeorBmr({ sex, weightKg, heightCm, ageYears: age });
  return {
    kcal: Math.round(rawBmr),
    formula: 'mifflin_st_jeor',
  };
}

/**
 * Computes maintenance calories (TDEE).
 * - If profile.maintenanceOverride is set (> 0), short-circuits and returns isOverride: true.
 * - Otherwise kcal = Math.round(bmr * ACTIVITY_MULTIPLIERS[profile.activityLevel]).
 */
export function computeMaintenanceCalories(
  profile: Partial<UserProfile> | null | undefined,
): MaintenanceResult | null {
  if (!profile) return null;

  if (
    typeof profile.maintenanceOverride === 'number' &&
    !Number.isNaN(profile.maintenanceOverride) &&
    profile.maintenanceOverride > 0
  ) {
    const overrideKcal = Math.round(profile.maintenanceOverride);
    const bmrResult = computeBmr(profile);
    const multiplier =
      profile.activityLevel && profile.activityLevel in ACTIVITY_MULTIPLIERS
        ? ACTIVITY_MULTIPLIERS[profile.activityLevel]
        : 1;

    return {
      kcal: overrideKcal,
      bmr: bmrResult ? bmrResult.kcal : overrideKcal,
      multiplier,
      formula: 'override',
      isOverride: true,
    };
  }

  const bmrResult = computeBmr(profile);
  if (!bmrResult) return null;

  if (
    !profile.activityLevel ||
    !(profile.activityLevel in ACTIVITY_MULTIPLIERS)
  ) {
    return null;
  }

  const multiplier = ACTIVITY_MULTIPLIERS[profile.activityLevel];
  const kcal = Math.round(bmrResult.kcal * multiplier);

  return {
    kcal,
    bmr: bmrResult.kcal,
    multiplier,
    formula: bmrResult.formula,
    isOverride: false,
  };
}

/**
 * Target calories based on goal adjustment, floored at 1200 kcal for safety.
 */
export function computeCalorieTarget(
  profile: Partial<UserProfile> | null | undefined,
): number | null {
  if (!profile) return null;

  const maintenance = computeMaintenanceCalories(profile);
  if (!maintenance) return null;

  if (!profile.goal || !(profile.goal in GOAL_ADJUSTMENTS)) return null;

  const adjustment = GOAL_ADJUSTMENTS[profile.goal];
  const target = maintenance.kcal + adjustment;

  return Math.max(1200, Math.round(target));
}

/**
 * Target macros in grams based on calorie target and weight.
 * protein g = Math.round(weightKg * (proteinPerKg ?? DEFAULT_PROTEIN_PER_KG))
 * fat g = Math.round(targetKcal * DEFAULT_FAT_CALORIE_SHARE / 9)
 * carbs g = Math.round((targetKcal - (protein*4 + fat*9)) / 4), floored at 0
 * If (protein*4 + fat*9) > targetKcal, scales protein and fat down proportionally, carbs = 0.
 */
export function computeMacroTargets(
  profile: Partial<UserProfile> | null | undefined,
): MacroNutrients | null {
  if (!profile) return null;

  const targetKcal = computeCalorieTarget(profile);
  if (targetKcal === null) return null;

  const { weightKg, proteinPerKg } = profile;
  if (
    typeof weightKg !== 'number' ||
    Number.isNaN(weightKg) ||
    weightKg < PROFILE_LIMITS.weightKg.min ||
    weightKg > PROFILE_LIMITS.weightKg.max
  ) {
    return null;
  }

  const proteinRatio =
    typeof proteinPerKg === 'number' && !Number.isNaN(proteinPerKg) && proteinPerKg > 0
      ? proteinPerKg
      : DEFAULT_PROTEIN_PER_KG;

  let protein = Math.round(weightKg * proteinRatio);
  let fat = Math.round((targetKcal * DEFAULT_FAT_CALORIE_SHARE) / 9);

  const calProtein = protein * 4;
  const calFat = fat * 9;
  const pfSum = calProtein + calFat;

  if (pfSum > targetKcal) {
    // Degenerate case: protein + fat exceed target calories.
    // Scale protein and fat down proportionally to fit targetKcal, carbs = 0.
    const proteinCalorieTarget = targetKcal * (calProtein / pfSum);
    const fatCalorieTarget = targetKcal * (calFat / pfSum);

    protein = Math.round(proteinCalorieTarget / 4);
    fat = Math.round(fatCalorieTarget / 9);

    return {
      calories: targetKcal,
      protein,
      carbs: 0,
      fat,
    };
  }

  const carbs = Math.max(0, Math.round((targetKcal - pfSum) / 4));

  return {
    calories: targetKcal,
    protein,
    carbs,
    fat,
  };
}
