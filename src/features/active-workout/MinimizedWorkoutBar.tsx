import React from 'react';
import { GestureResponderHandlers, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronUp } from 'lucide-react-native';
import { theme } from '../../theme';
import { ActiveWorkout } from '../../types';
import { useElapsedMinutes } from './useElapsedMinutes';
import { formatWorkoutTitle, MINI_BAR_HEIGHT, summarizeWorkoutSets } from './workoutSessionUtils';

/** Props for the compact minimized active-workout bar. */
export interface MinimizedWorkoutBarProps {
  workout: ActiveWorkout;
  onResume: () => void;
  panHandlers?: GestureResponderHandlers;
}

/** Compact docked bar displaying a minimized active workout with tap or swipe-up to resume. */
export const MinimizedWorkoutBar: React.FC<MinimizedWorkoutBarProps> = ({
  workout,
  onResume,
  panHandlers,
}) => {
  const elapsedMinutes = useElapsedMinutes(workout.startTime);
  const summary = summarizeWorkoutSets(workout.sets);
  const title = formatWorkoutTitle(workout.name, workout.category);

  return (
    <View style={styles.wrapper} {...panHandlers}>
      <View style={styles.dragPill} />
      <TouchableOpacity
        style={styles.content}
        onPress={onResume}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${summary.summaryLabel}, ${elapsedMinutes} min`}
        accessibilityHint="Tap or swipe up to resume workout"
      >
        <View style={styles.indicator} />

        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {summary.summaryLabel}
          </Text>
        </View>

        <View style={styles.rightCluster}>
          <Text style={styles.elapsedText}>{elapsedMinutes} min</Text>
          <View style={styles.expandButton}>
            <ChevronUp size={18} color={theme.colors.text} />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    height: MINI_BAR_HEIGHT,
    backgroundColor: theme.colors.surfaceHighlight,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  dragPill: {
    alignSelf: 'center',
    width: 32,
    height: 3,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.border,
    marginTop: 5,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 2,
    gap: theme.spacing.sm,
  },
  indicator: {
    width: 3,
    height: 28,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
  },
  textBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  elapsedText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    fontVariant: ['tabular-nums'],
  },
  expandButton: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
