import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar as CalendarIcon, CheckSquare, Trash2 } from 'lucide-react-native';
import { Card } from '../../components';
import { theme } from '../../theme';
import { CompletedWorkout } from '../../types';
import { formatTime, minutesBetween } from '../../utils/date';
import { resolveEquipmentType } from '../../utils/exercise';
import { formatSetDisplay } from '../../utils/format';

interface WorkoutCardProps {
  workout: CompletedWorkout;
  /** Past days are read-only, so deleting is only offered for today. */
  onDelete?: () => void;
}

export const WorkoutCard: React.FC<WorkoutCardProps> = ({ workout, onDelete }) => {
  const equipmentType = resolveEquipmentType(workout.name, workout.equipmentType);
  const sets = workout.workoutData?.sets ?? [];
  const duration = Math.max(1, minutesBetween(workout.startTime, workout.endTime));

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
          <Text style={styles.statText}>{workout.totalSets} sets</Text>
        </View>
      </View>

      {sets.length > 0 ? (
        <View style={styles.setsContainer}>
          {sets.map((set, index) => (
            <View key={set.id} style={styles.setRow}>
              <Text style={styles.setIndex}>Set {index + 1}</Text>
              <Text style={styles.setDetail}>
                {formatSetDisplay(set.weight, set.reps, equipmentType)}
              </Text>
              {set.completed ? (
                <CheckSquare size={14} color={theme.colors.success} />
              ) : (
                <View style={styles.uncompletedDot} />
              )}
            </View>
          ))}
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
  setIndex: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    width: 60,
  },
  setDetail: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    flex: 1,
  },
  uncompletedDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: theme.colors.textSecondary,
  },
});
