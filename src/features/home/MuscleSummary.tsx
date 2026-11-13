import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Chip } from '../../components';
import { MUSCLE_LABELS, MuscleId } from '../../constants/muscles';
import { theme } from '../../theme';
import { ActivityPeriod, MuscleActivityEntry } from './muscleActivity';

export interface MuscleSummaryProps {
  period: ActivityPeriod;
  totals: { workouts: number; sets: number; warmupSets?: number };
  unmapped: number;
  muscles: Partial<Record<MuscleId, MuscleActivityEntry>>;
  selectedMuscle: MuscleId | null;
  onSelectMuscle: (muscleId: MuscleId) => void;
  onStartWorkout: () => void;
}

const formatCount = (count: number, singular: string, plural = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : plural}`;

const sortWorkedMuscles = (
  muscles: Partial<Record<MuscleId, MuscleActivityEntry>>,
): [MuscleId, MuscleActivityEntry][] =>
  (Object.entries(muscles) as [MuscleId, MuscleActivityEntry | undefined][])
    .filter((pair): pair is [MuscleId, MuscleActivityEntry] => Boolean(pair[1]))
    .sort(
      ([aId, aEntry], [bId, bEntry]) =>
        bEntry.effectiveLoad - aEntry.effectiveLoad ||
        bEntry.sets - aEntry.sets ||
        MUSCLE_LABELS[aId].localeCompare(MUSCLE_LABELS[bId]),
    );

/**
 * Compact footer strip summarizing workout totals and worked muscles for the
 * active period, or prompting the user to start a workout when empty.
 */
export const MuscleSummary: React.FC<MuscleSummaryProps> = ({
  period,
  totals,
  unmapped,
  muscles,
  selectedMuscle,
  onSelectMuscle,
  onStartWorkout,
}) => {
  if (totals.workouts === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>
            {period === 'daily' ? 'No workouts today' : 'No workouts this week'}
          </Text>
          <Button title="Start workout" size="small" onPress={onStartWorkout} />
        </View>
      </View>
    );
  }

  const workedMuscles = sortWorkedMuscles(muscles);
  const warmupSets = totals.warmupSets ?? 0;
  const summaryText = `${formatCount(totals.workouts, 'workout')}, ${formatCount(totals.sets, 'set')}`;
  const notes: string[] = [];
  if (unmapped > 0) {
    notes.push(`${unmapped} not shown on body`);
  }
  if (warmupSets > 0) {
    notes.push(`${formatCount(warmupSets, 'warm-up')} excluded`);
  }
  const secondaryNote = notes.length > 0 ? notes.join(' · ') : null;

  return (
    <View style={styles.card}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>{summaryText}</Text>
        {secondaryNote ? <Text style={styles.unmappedText}>{secondaryNote}</Text> : null}
      </View>

      {workedMuscles.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsContent}
        >
          {workedMuscles.map(([id, entry], index) => (
            <Chip
              key={id}
              label={
                entry.sets > 0
                  ? `${MUSCLE_LABELS[id]} (${entry.sets})`
                  : `${MUSCLE_LABELS[id]} (warm-up)`
              }
              variant="option"
              selected={selectedMuscle === id}
              onPress={() => onSelectMuscle(id)}
              style={index === workedMuscles.length - 1 ? styles.lastChip : undefined}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  emptyText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  summaryText: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
  },
  unmappedText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
  },
  chipsScroll: {
    marginTop: theme.spacing.sm,
  },
  chipsContent: {
    alignItems: 'center',
  },
  lastChip: {
    marginRight: 0,
  },
});
