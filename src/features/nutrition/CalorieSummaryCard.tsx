import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '../../components';
import { GOAL_LABELS } from '../../constants/nutrition';
import { theme } from '../../theme';
import { MacroNutrients } from '../../types';
import { formatCalories } from '../../utils/format';
import { useProfileStore } from '../../store/profileStore';
import { classifyEnergyBalance, STATUS_LABELS, statusColor } from './energyBalance';
import { computeCalorieTarget, computeMaintenanceCalories } from './energyFormulas';
import { computeRemaining } from './nutritionTotals';

interface CalorieSummaryCardProps {
  totals: MacroNutrients;
  entryCount: number;
  onOpenProfile: () => void;
}

export const CalorieSummaryCard: React.FC<CalorieSummaryCardProps> = ({
  totals,
  entryCount,
  onOpenProfile,
}) => {
  const profile = useProfileStore((state) => state.profile);

  const maintenanceResult = useMemo(
    () => computeMaintenanceCalories(profile),
    [profile],
  );
  const maintenanceKcal = maintenanceResult?.kcal ?? null;

  const targetKcal = useMemo(
    () => computeCalorieTarget(profile),
    [profile],
  );

  const referenceKcal = targetKcal ?? maintenanceKcal;

  const energyVerdict = useMemo(
    () =>
      classifyEnergyBalance(totals.calories, maintenanceKcal, {
        hasEntries: entryCount > 0,
      }),
    [totals.calories, maintenanceKcal, entryCount],
  );

  const remaining = useMemo(() => {
    if (referenceKcal == null) return null;
    return computeRemaining(totals, referenceKcal);
  }, [totals, referenceKcal]);

  const targetLabel = useMemo(() => {
    if (targetKcal == null || !profile?.goal) return null;
    return `${GOAL_LABELS[profile.goal]} target: ${formatCalories(targetKcal)} kcal`;
  }, [targetKcal, profile?.goal]);

  // Priority 1: No profile or maintenance is unknown
  if (profile === null || maintenanceKcal === null) {
    return (
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.consumedKcal}>{formatCalories(totals.calories)}</Text>
            <Text style={styles.unitLabel}>kcal consumed</Text>
          </View>
        </View>

        <View style={styles.promptContainer}>
          <Text style={styles.promptText}>
            Set up your profile to calculate maintenance calories
          </Text>
          <Button
            title="Set Up Profile"
            size="small"
            onPress={onOpenProfile}
            style={styles.promptButton}
          />
        </View>
      </Card>
    );
  }

  // Priority 2: Maintenance known, but entryCount === 0
  if (entryCount === 0) {
    return (
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <View style={styles.caloriesRow}>
              <Text style={styles.consumedKcal}>0</Text>
              <Text style={styles.maintenanceSubtext}>
                {' '}of {formatCalories(maintenanceKcal)} maintenance
              </Text>
            </View>
          </View>
          <View style={styles.emptyPill}>
            <Text style={styles.emptyPillText}>Nothing logged yet</Text>
          </View>
        </View>

        {/* Empty progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '0%' }]} />
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerSecondary}>
            {referenceKcal ? `${formatCalories(referenceKcal)} kcal left` : ''}
          </Text>
          {targetLabel ? <Text style={styles.targetText}>{targetLabel}</Text> : null}
        </View>
      </Card>
    );
  }

  // Priority 3: Full card with both known and entries > 0
  const progressRatio = referenceKcal ? totals.calories / referenceKcal : 0;
  const progressPercent = Math.min(100, Math.max(0, progressRatio * 100));
  const isOverTarget = referenceKcal ? totals.calories > referenceKcal : false;
  const activeColor = energyVerdict
    ? statusColor(energyVerdict.status)
    : theme.colors.primary;

  const deltaSign = energyVerdict && energyVerdict.deltaKcal > 0 ? '+' : '';
  const pillLabel = energyVerdict
    ? `${STATUS_LABELS[energyVerdict.status]} ${deltaSign}${formatCalories(energyVerdict.deltaKcal)} kcal`
    : null;

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.caloriesContainer}>
          <View style={styles.caloriesRow}>
            <Text style={styles.consumedKcal}>{formatCalories(totals.calories)}</Text>
            <Text style={styles.maintenanceSubtext}>
              {' '}of {formatCalories(maintenanceKcal)} maintenance
            </Text>
          </View>
        </View>

        {pillLabel && energyVerdict ? (
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: `${activeColor}1F`,
                borderColor: activeColor,
              },
            ]}
          >
            <Text style={[styles.statusPillText, { color: activeColor }]}>
              {pillLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: activeColor,
              },
            ]}
          />
        </View>
        {isOverTarget && (
          <View style={styles.overIndicator}>
            <View style={[styles.overIndicatorBar, { backgroundColor: theme.colors.danger }]} />
          </View>
        )}
      </View>

      {/* Remaining & Target Footer */}
      <View style={styles.footerRow}>
        {remaining ? (
          <Text
            style={[
              styles.remainingText,
              remaining.isOver && styles.remainingOverText,
            ]}
          >
            {formatCalories(remaining.kcal)} kcal {remaining.isOver ? 'over' : 'left'}
          </Text>
        ) : null}

        {targetLabel ? <Text style={styles.targetText}>{targetLabel}</Text> : null}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  caloriesContainer: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  caloriesRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  consumedKcal: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.bold,
  },
  maintenanceSubtext: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  unitLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
  },
  promptContainer: {
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  promptText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    textAlign: 'center',
  },
  promptButton: {
    minWidth: 140,
  },
  emptyPill: {
    backgroundColor: theme.colors.surfaceHighlight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  emptyPillText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  statusPill: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
  },
  progressContainer: {
    position: 'relative',
    marginBottom: theme.spacing.sm,
  },
  progressTrack: {
    height: 10,
    backgroundColor: theme.colors.nutrition.track,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
  },
  overIndicator: {
    position: 'absolute',
    right: 0,
    top: -2,
    bottom: -2,
    width: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overIndicatorBar: {
    width: 3,
    height: 14,
    borderRadius: 1,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  remainingText: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
  },
  remainingOverText: {
    color: theme.colors.nutrition.surplus,
  },
  footerSecondary: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
  },
  targetText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
  },
});
