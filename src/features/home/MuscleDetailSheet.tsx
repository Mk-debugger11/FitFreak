import React from 'react';
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { Button, ModalEmptyText, ModalSheet } from '../../components';
import { MUSCLE_LABELS, MuscleId } from '../../constants/muscles';
import { theme } from '../../theme';
import { interpolateHeatColor } from './doseResponse';
import {
  ActivityLevel,
  ActivityPeriod,
  MuscleActivityEntry,
  MuscleExerciseContribution,
  MuscleRole,
  VolumeZone,
} from './muscleActivity';

export interface MuscleDetailSheetProps {
  muscleId: MuscleId | null;
  entry: MuscleActivityEntry | null;
  period?: ActivityPeriod;
  onClose: () => void;
}

const LEVEL_LABELS: Record<ActivityLevel, string> = {
  none: 'Rest',
  light: 'Light',
  moderate: 'Moderate',
  high: 'High',
};

const VOLUME_ZONE_LABELS: Record<VolumeZone, string> = {
  rest: 'Rest',
  warmup_only: 'Warm-up only',
  starter: 'Starter',
  effective: 'Effective',
  optimal: 'Optimal',
  high_volume: 'High volume',
  diminishing_returns: 'Diminishing returns',
  maintenance: 'Maintenance',
  mev_building: 'Building',
  optimal_mav: 'Optimal range',
  very_high_volume: 'Very high volume',
};

const ROLE_LABELS: Record<MuscleRole, string> = {
  primary: 'Direct',
  secondary: 'Synergist',
  stabilizer: 'Stabilizer',
};

const ROLE_ORDER: Record<MuscleRole, number> = {
  primary: 0,
  secondary: 1,
  stabilizer: 2,
};

const PERIOD_LABELS: Record<ActivityPeriod, string> = {
  daily: 'Today',
  weekly: 'This week',
};

const formatSets = (count: number): string => `${count} ${count === 1 ? 'set' : 'sets'}`;

const clampPct = (value: number): number =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;

const sortExercises = (
  exercises: readonly MuscleExerciseContribution[],
): MuscleExerciseContribution[] =>
  [...exercises].sort((a, b) => {
    const roleDiff = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
    if (roleDiff !== 0) return roleDiff;
    return b.sets - a.sets || b.warmupSets - a.warmupSets || a.name.localeCompare(b.name);
  });

/**
 * Modal breakdown showing a selected muscle's intensity level, volume zone,
 * working/warm-up breakdown, dose-response load metrics, and contributing exercises.
 */
export const MuscleDetailSheet: React.FC<MuscleDetailSheetProps> = ({
  muscleId,
  entry,
  period,
  onClose,
}) => {
  const exercises = entry ? sortExercises(entry.exercises) : [];
  const emptyCopy =
    period === 'daily'
      ? 'Not trained today.'
      : period === 'weekly'
        ? 'Not trained this week.'
        : 'Not trained in this period.';

  return (
    <ModalSheet
      visible={muscleId !== null}
      title={muscleId ? MUSCLE_LABELS[muscleId] : ''}
      scrollable
      footer={<Button title="Done" onPress={onClose} style={styles.doneButton} />}
    >
      {entry ? (
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <View style={styles.pillsGroup}>
              <View
                style={[
                  styles.levelPill,
                  { backgroundColor: theme.colors.anatomy[entry.level] },
                ]}
              >
                <Text style={styles.levelPillText}>{LEVEL_LABELS[entry.level]}</Text>
              </View>
              <View style={styles.zonePill}>
                <Text style={styles.zonePillText}>
                  {VOLUME_ZONE_LABELS[entry.volumeZone]}
                </Text>
              </View>
            </View>
            {period ? (
              <Text style={styles.periodText}>{PERIOD_LABELS[period]}</Text>
            ) : null}
          </View>

          <View style={styles.breakdownGroup}>
            <Text style={styles.breakdownText}>
              {`${entry.primarySets} direct · ${entry.secondarySets} synergist · ${entry.stabilizerSets} stabilizer`}
            </Text>
            {entry.warmupSets > 0 ? (
              <Text style={styles.warmupExclusionText}>
                {`${entry.warmupSets} warm-up set${entry.warmupSets === 1 ? '' : 's'} excluded`}
              </Text>
            ) : null}
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statColumn}>
                <Text style={styles.statValue}>{entry.effectiveLoad.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Effective Load</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statColumn}>
                <Text style={styles.statValue}>{entry.rawWeightedSets.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Raw Weighted</Text>
              </View>
            </View>

            <View style={styles.saturationBlock}>
              <View style={styles.saturationHeader}>
                <Text style={styles.statLabel}>Stimulus Saturation</Text>
                <Text style={styles.saturationValue}>{`${entry.stimulusSaturationPct}%`}</Text>
              </View>
              <View style={styles.saturationTrack}>
                <View
                  style={[
                    styles.saturationFill,
                    {
                      width: `${clampPct(entry.stimulusSaturationPct)}%`,
                      backgroundColor: interpolateHeatColor(entry.heatmapIntensity),
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          <View style={styles.exerciseList}>
            {exercises.map((item, index) => {
              const isLast = index === exercises.length - 1;
              const setsSummary =
                item.warmupSets > 0
                  ? `${formatSets(item.sets)} + ${item.warmupSets} warm-up`
                  : formatSets(item.sets);

              return (
                <View
                  key={`${item.name}-${item.role}`}
                  style={[styles.exerciseRow, isLast && styles.exerciseRowLast]}
                >
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{item.name}</Text>
                    <Text style={styles.exerciseSets}>{setsSummary}</Text>
                  </View>
                  <View style={[styles.roleBadge, roleBadgeStyles[item.role]]}>
                    <Text style={[styles.roleText, roleTextStyles[item.role]]}>
                      {ROLE_LABELS[item.role]}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <ModalEmptyText>{emptyCopy}</ModalEmptyText>
      )}
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  body: {
    gap: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  pillsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  levelPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  levelPillText: {
    color: theme.colors.onPrimary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
  },
  zonePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  zonePillText: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  periodText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  breakdownGroup: {
    gap: theme.spacing.xs,
  },
  breakdownText: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  warmupExclusionText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
  },
  statsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statColumn: {
    flex: 1,
    gap: 2,
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.sm,
  },
  statValue: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
  },
  statLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  saturationBlock: {
    gap: 6,
  },
  saturationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  saturationValue: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
  },
  saturationTrack: {
    height: 6,
    width: '100%',
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceHighlight,
    overflow: 'hidden',
  },
  saturationFill: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
  },
  exerciseList: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  exerciseRowLast: {
    borderBottomWidth: 0,
  },
  exerciseInfo: {
    flex: 1,
    gap: 2,
  },
  exerciseName: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.medium,
  },
  exerciseSets: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
  },
  roleBadge: {
    flexShrink: 0,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
  },
  primaryRoleBadge: {
    borderColor: theme.colors.primary,
  },
  secondaryRoleBadge: {
    borderColor: theme.colors.border,
  },
  stabilizerRoleBadge: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceHighlight,
  },
  roleText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  primaryRoleText: {
    color: theme.colors.primary,
  },
  secondaryRoleText: {
    color: theme.colors.text,
  },
  stabilizerRoleText: {
    color: theme.colors.textSecondary,
  },
  doneButton: {
    marginTop: theme.spacing.md,
  },
});

const roleBadgeStyles: Record<MuscleRole, ViewStyle> = {
  primary: styles.primaryRoleBadge,
  secondary: styles.secondaryRoleBadge,
  stabilizer: styles.stabilizerRoleBadge,
};

const roleTextStyles: Record<MuscleRole, TextStyle> = {
  primary: styles.primaryRoleText,
  secondary: styles.secondaryRoleText,
  stabilizer: styles.stabilizerRoleText,
};
