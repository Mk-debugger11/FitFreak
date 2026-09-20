import React from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components';
import { useActiveWorkoutStore } from '../../store/activeWorkoutStore';
import { useHistoryStore } from '../../store/historyStore';
import { theme } from '../../theme';
import { DEFAULT_EQUIPMENT_TYPE } from '../../types';
import { minutesBetween } from '../../utils/date';
import { AddSetForm } from './AddSetForm';
import { SetRow } from './SetRow';

/** Sets aren't tied to a catalogue exercise yet — the workout names itself. */
const EXERCISE_ID = 'custom-exercise';

/** Logs sets for the workout in progress. */
export const ActiveWorkoutScreen: React.FC = () => {
  const {
    currentWorkout,
    startWorkout,
    updateWorkoutName,
    addSet,
    updateSet,
    deleteSet,
    toggleSetComplete,
    finishWorkout,
    cancelWorkout,
  } = useActiveWorkoutStore();
  const addCompletedWorkout = useHistoryStore((state) => state.addCompletedWorkout);
  const addCustomExercise = useHistoryStore((state) => state.addCustomExercise);

  if (!currentWorkout) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No active workout</Text>
        <Button title="Start Empty Workout" onPress={() => startWorkout('Empty Workout')} />
      </View>
    );
  }

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
    <View style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.titleInput}
          value={currentWorkout.name}
          onChangeText={updateWorkoutName}
          onEndEditing={(event) => handleNameCommitted(event.nativeEvent.text)}
          placeholder="Workout Name"
          placeholderTextColor={theme.colors.textSecondary}
        />
        <Text style={styles.timeText}>
          {minutesBetween(currentWorkout.startTime, new Date())} min
        </Text>
      </View>

      <FlatList
        data={currentWorkout.sets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
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
            onDelete={() => deleteSet(item.id)}
          />
        )}
      />

      <View style={styles.footer}>
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
    </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  titleInput: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    flex: 1,
    marginRight: theme.spacing.sm,
    padding: 0,
  },
  timeText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.medium,
  },
  list: {
    padding: theme.spacing.md,
  },
  footer: {
    flexDirection: 'row',
    padding: theme.spacing.md,
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
