import { theme } from '../../theme';
import { MAINTENANCE_BAND } from '../../constants/nutrition';

export type EnergyBalanceStatus = 'deficit' | 'maintenance' | 'surplus';

export interface EnergyBalanceVerdict {
  status: EnergyBalanceStatus;
  deltaKcal: number;
  toleranceKcal: number;
}

export const STATUS_LABELS: Record<EnergyBalanceStatus, string> = {
  deficit: 'Deficit',
  maintenance: 'Maintenance',
  surplus: 'Surplus',
};

/**
 * Returns theme color corresponding to the energy balance status.
 */
export function statusColor(status: EnergyBalanceStatus): string {
  return theme.colors.nutrition[status];
}

/**
 * Classifies a day's energy balance relative to maintenance calories.
 * Returns null when maintenanceKcal is null/undefined/0/<=0 OR when options.hasEntries is false.
 * Tolerance band is max(minKcal, maintenance * fraction).
 * |delta| <= tolerance -> 'maintenance'; delta < 0 -> 'deficit'; else 'surplus'
 */
export function classifyEnergyBalance(
  intakeKcal: number,
  maintenanceKcal: number | null | undefined,
  options: { hasEntries: boolean },
): EnergyBalanceVerdict | null {
  if (!options?.hasEntries) {
    return null;
  }

  if (
    maintenanceKcal === null ||
    maintenanceKcal === undefined ||
    Number.isNaN(maintenanceKcal) ||
    maintenanceKcal <= 0
  ) {
    return null;
  }

  const toleranceKcal = Math.max(
    MAINTENANCE_BAND.minKcal,
    maintenanceKcal * MAINTENANCE_BAND.fraction,
  );

  const deltaKcal = Math.round(intakeKcal - maintenanceKcal) || 0;

  let status: EnergyBalanceStatus;
  if (Math.abs(deltaKcal) <= toleranceKcal) {
    status = 'maintenance';
  } else if (deltaKcal < 0) {
    status = 'deficit';
  } else {
    status = 'surplus';
  }

  return {
    status,
    deltaKcal,
    toleranceKcal,
  };
}

