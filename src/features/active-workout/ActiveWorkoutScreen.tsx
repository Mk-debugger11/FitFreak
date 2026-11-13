import React from 'react';
import {
  FlatList,
  GestureResponderHandlers,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown } from 'lucide-react-native';
import { Button } from '../../components';
import { useActiveWorkoutStore } from '../../store/activeWorkoutStore';
import { useHistoryStore } from '../../store/historyStore';
import { theme } from '../../theme';
import { DEFAULT_EQUIPMENT_TYPE } from '../../types';
import { AddSetForm } from './AddSetForm';
import { SetRow } from './SetRow';
import { useElapsedMinutes } from './useElapsedMinutes';
import { summarizeWorkoutSets } from './workoutSessionUtils';

/** Sets aren't tied to a catalogue exercise yet — the workout names itself. */
const EXERCISE_ID = 'custom-exercise';

/** Props for the active workout logging screen. */
export interface ActiveWorkoutScreenProps {
  onMinimize?: () => void;
  headerPanHandlers?: GestureResponderHandlers;
}

/** Logs sets for the workout in progress. */
export const ActiveWorkoutScreen: React.FC<ActiveWorkoutScreenProps> = ({
  onMinimize,
  headerPanHandlers,
}) => {
  const currentWorkout = useActiveWorkoutStore((state) => state.currentWorkout);
  const startWorkout = useActiveWorkoutStore((state) => state.startWorkout);
  const updateWorkoutName = useActiveWorkoutStore((state) => state.updateWorkoutName);
  const addSet = useActiveWorkoutStore((state) => state.addSet);
  const updateSet = useActiveWorkoutStore((state) => state.updateSet);
  const deleteSet = useActiveWorkoutStore((state) => state.deleteSet);
  const toggleSetComplete = useActiveWorkoutStore((state) => state.toggleSetComplete);
  const toggleSetWarmup = useActiveWorkoutStore((state) => state.toggleSetWarmup);
  const finishWorkout = useActiveWorkoutStore((state) => state.finishWorkout);
  const cancelWorkout = useActiveWorkoutStore((state) => state.cancelWorkout);
  const minimizeWorkout = useActiveWorkoutStore((state) => state.minimizeWorkout);
  const addCompletedWorkout = useHistoryStore((state) => state.addCompletedWorkout);
  const addCustomExercise = useHistoryStore((state) => state.addCustomExercise);
  const insets = useSafeAreaInsets();
  const elapsedMinutes = useElapsedMinutes(currentWorkout?.startTime);

  if (!currentWorkout) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No active workout</Text>
        <Button title="Start Empty Workout" onPress={() => startWorkout('Empty Workout')} />
      </View>
    );
  }

  const { warmupCount, summaryLabel } = summarizeWorkoutSets(currentWorkout.sets);
  const handleMinimize = onMinimize ?? minimizeWorkout;

  const handleFinish = () => {
    const completed = finishWorkout();
    if (completed) {
      addCompletedWorkout(completed);
    }
  };

  /** Naming a workout also saves that name as a custom exercise. */
  const handleNameCommitted = (name: string) => {
    if (!name || !currentWorkout.category) return;
    addCustomExercise(
      currentWorkout.category,
      name,
      currentWorkout.equipmentType ?? DEFAULT_EQUIPMENT_TYPE,
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.xs }]}>
        <View {...headerPanHandlers}>
          <View style={styles.dragHandle} />
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.minimizeButton}
              onPress={handleMinimize}
              hitSlop={8}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Minimize workout"
            >
              <ChevronDown size={16} color={theme.colors.textSecondary} />
              <Text style={styles.minimizeText}>Minimize</Text>
            </TouchableOpacity>
            <Text style={styles.timeText}>{elapsedMinutes} min</Text>
          </View>
        </View>

        <TextInput
          style={styles.titleInput}
          value={currentWorkout.name}
          onChangeText={updateWorkoutName}
          onEndEditing={(event) => handleNameCommitted(event.nativeEvent.text)}
          placeholder="Workout Name"
          placeholderTextColor={theme.colors.textSecondary}
        />
        {warmupCount > 0 ? <Text style={styles.setSummary}>{summaryLabel}</Text> : null}
      </View>

      <FlatList
        data={currentWorkout.sets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <AddSetForm onAddSet={(weight, reps) => addSet(EXERCISE_ID, weight, reps)} />
        }
        renderItem={({ item, index }) => (
          <SetRow
            set={item}
            index={index}
            equipmentType={currentWorkout.equipmentType}
            onChange={(weight, reps) => updateSet(item.id, weight, reps)}
            onToggleComplete={() => toggleSetComplete(item.id)}
            onToggleWarmup={() => toggleSetWarmup(item.id)}
            onDelete={() => deleteSet(item.id)}
          />
        )}
      />

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, theme.spacing.md) }]}>
        <Button
          title="Cancel"
          variant="outline"
          onPress={cancelWorkout}
          style={styles.footerButtonLeft}
        />
        <Button
          title="Finish"
          variant="primary"
          onPress={handleFinish}
          style={styles.footerButtonRight}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.lg,
    marginBottom: theme.spacing.lg,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  minimizeButton: {
    backgroundColor: theme.colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  minimizeText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
  },
  setSummary: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    marginTop: theme.spacing.xs,
  },
  titleInput: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    padding: 0,
  },
  timeText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    fontVariant: ['tabular-nums'],
  },
  list: {
    padding: theme.spacing.md,
  },
  footer: {
    flexDirection: 'row',
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerButtonLeft: {
    flex: 1,
    marginRight: 8,
  },
  footerButtonRight: {
    flex: 1,
    marginLeft: 8,
  },
});
