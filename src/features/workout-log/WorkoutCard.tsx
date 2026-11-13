import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar as CalendarIcon, CheckSquare, Trash2 } from 'lucide-react-native';
import { Card } from '../../components';
import { theme } from '../../theme';
import { CompletedWorkout, WorkoutSet } from '../../types';
import { formatTime, minutesBetween } from '../../utils/date';
import { resolveEquipmentType } from '../../utils/exercise';
import { formatSetDisplay } from '../../utils/format';
import { partitionWorkoutSets } from '../home/setPartitioner';

interface WorkoutCardProps {
  workout: CompletedWorkout;
  /** Past days are read-only, so deleting is only offered for today. */
  onDelete?: () => void;
}

const formatCount = (count: number, singular: string, plural = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : plural}`;

/** Summary card displaying a completed workout, its working-set totals, and logged sets. */
export const WorkoutCard: React.FC<WorkoutCardProps> = ({ workout, onDelete }) => {
  const equipmentType = resolveEquipmentType(workout.name, workout.equipmentType);
  const sets = workout.workoutData?.sets ?? [];
  const duration = Math.max(1, minutesBetween(workout.startTime, workout.endTime));
  const partitioned = partitionWorkoutSets(sets);
  const warmupSetRefs = new Set(partitioned.warmupSets);
  const isWarmupSet = (set: WorkoutSet): boolean =>
    set.isWarmup === true || warmupSetRefs.has(set);
  const warmupCount = sets.filter(isWarmupSet).length;
  const workingSetCount =
    sets.length > 0 && warmupCount > 0 ? partitioned.workingSets.length : workout.totalSets;
  const setSummaryText =
    warmupCount > 0
      ? `${formatCount(workingSetCount, 'working set')}, ${formatCount(warmupCount, 'warm-up')}`
      : formatCount(workingSetCount, 'set');

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {workout.category ? (
            <Text style={styles.category}>{workout.category.toUpperCase()}</Text>
          ) : null}
          <Text style={styles.title}>{workout.name || 'Unnamed Exercise'}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.time}>{formatTime(workout.startTime)}</Text>
          {onDelete ? (
            <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
              <Trash2 color={theme.colors.error} size={20} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <CalendarIcon size={16} color={theme.colors.textSecondary} />
          <Text style={styles.statText}>{duration} min</Text>
        </View>
        <View style={styles.stat}>
          <CheckSquare size={16} color={theme.colors.textSecondary} />
          <Text style={styles.statText}>{setSummaryText}</Text>
        </View>
      </View>

      {sets.length > 0 ? (
        <View style={styles.setsContainer}>
          {sets.map((set, index) => {
            const warmup = isWarmupSet(set);
            return (
              <View key={set.id} style={[styles.setRow, warmup && styles.setRowWarmup]}>
                <View style={styles.setIndexGroup}>
                  <Text style={styles.setIndex}>Set {index + 1}</Text>
                  {warmup ? (
                    <View style={styles.warmupBadge} accessibilityLabel="Warm-up set">
                      <Text style={styles.warmupBadgeText}>W</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.setDetail, warmup && styles.setDetailWarmup]}>
                  {formatSetDisplay(set.weight, set.reps, equipmentType)}
                </Text>
                {set.completed ? (
                  <CheckSquare size={14} color={theme.colors.success} />
                ) : (
                  <View style={styles.uncompletedDot} />
                )}
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  category: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    marginBottom: 2,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    flex: 1,
    padding: 0,
    marginRight: theme.spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
  },
  deleteButton: {
    marginLeft: 12,
    padding: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    marginLeft: 4,
  },
  setsContainer: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  setRowWarmup: {
    opacity: 0.85,
  },
  setIndexGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 84,
    marginRight: theme.spacing.sm,
  },
  setIndex: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
  },
  warmupBadge: {
    backgroundColor: theme.colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 6,
  },
  warmupBadgeText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
  },
  setDetail: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    flex: 1,
  },
  setDetailWarmup: {
    color: theme.colors.textSecondary,
  },
  uncompletedDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: theme.colors.textSecondary,
  },
});
