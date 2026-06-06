import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { theme } from '../../../../core/theme/theme';
import { useActiveWorkoutStore } from '../state/useActiveWorkoutStore';
import { useHistoryStore } from '../../../history/presentation/state/useHistoryStore';
import { Button } from '../../../../shared/components/Button';
import { Input } from '../../../../shared/components/Input';
import { Card } from '../../../../shared/components/Card';
import { Check, Plus, Trash2 } from 'lucide-react-native';

export const ActiveWorkoutScreen = () => {
  const { currentWorkout, addSet, toggleSetComplete, finishWorkout, cancelWorkout, startWorkout, updateWorkoutName, updateSet, deleteSet } = useActiveWorkoutStore();
  const { addCompletedWorkout, addCustomExercise } = useHistoryStore();
  
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

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

  const handleAddSet = () => {
    if (weight && reps) {
      addSet('custom-exercise', parseFloat(weight), parseInt(reps, 10));
      setWeight('');
      setReps('');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TextInput 
          style={styles.titleInput}
          value={currentWorkout.name}
          onChangeText={updateWorkoutName}
          onEndEditing={(e) => {
            const text = e.nativeEvent.text;
            if (text && currentWorkout.category) {
              addCustomExercise(currentWorkout.category, text);
            }
          }}
          placeholder="Workout Name"
          placeholderTextColor={theme.colors.textSecondary}
        />
        <Text style={styles.timeText}>
          {Math.floor((new Date().getTime() - currentWorkout.startTime.getTime()) / 60000)} min
        </Text>
      </View>

      <FlatList
        data={currentWorkout.sets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Card style={styles.addSetCard}>
            <Text style={styles.cardTitle}>Add Set</Text>
            <View style={styles.inputRow}>
              <Input 
                placeholder="Weight" 
                keyboardType="numeric"
                value={weight}
                onChangeText={setWeight}
                containerStyle={styles.input}
              />
              <Input 
                placeholder="Reps" 
                keyboardType="numeric"
                value={reps}
                onChangeText={setReps}
                containerStyle={styles.input}
              />
              <TouchableOpacity style={styles.addButton} onPress={handleAddSet}>
                <Plus color="#FFFFFF" size={24} />
              </TouchableOpacity>
            </View>
          </Card>
        }
        renderItem={({ item, index }) => (
          <View style={[styles.setRow, item.completed && styles.setRowCompleted]}>
            <Text style={styles.setText}>Set {index + 1}</Text>
            
            <TextInput
              style={styles.setInlineInput}
              value={item.weight.toString()}
              onChangeText={(text) => updateSet(item.id, parseFloat(text) || 0, item.reps)}
              keyboardType="numeric"
            />
            <Text style={styles.setTextInlineLabel}>kg</Text>
            
            <TextInput
              style={styles.setInlineInput}
              value={item.reps.toString()}
              onChangeText={(text) => updateSet(item.id, item.weight, parseInt(text, 10) || 0)}
              keyboardType="numeric"
            />
            <Text style={styles.setTextInlineLabel}>reps</Text>
            
            <TouchableOpacity 
              style={[styles.checkButton, item.completed && styles.checkButtonActive]}
              onPress={() => toggleSetComplete(item.id)}
            >
              <Check color={item.completed ? '#000' : '#FFF'} size={16} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.deleteButton} onPress={() => deleteSet(item.id)}>
              <Trash2 color="#FF4444" size={20} />
            </TouchableOpacity>
          </View>
        )}
      />

      <View style={styles.footer}>
        <Button title="Cancel" variant="outline" onPress={() => cancelWorkout()} style={{ flex: 1, marginRight: 8 }} />
        <Button title="Finish" variant="primary" onPress={handleFinish} style={{ flex: 1, marginLeft: 8 }} />
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
    fontWeight: theme.typography.weights.bold as any,
    flex: 1,
    marginRight: theme.spacing.sm,
    padding: 0,
  },
  timeText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.medium as any,
  },
  list: {
    padding: theme.spacing.md,
  },
  addSetCard: {
    marginBottom: theme.spacing.lg,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.md,
    fontWeight: 'bold',
    marginBottom: theme.spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    marginRight: theme.spacing.sm,
    marginBottom: 0,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceHighlight,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  setRowCompleted: {
    opacity: 0.6,
  },
  setText: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.md,
    flex: 1,
  },
  setInlineInput: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 48,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  setTextInlineLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    marginLeft: 4,
    marginRight: 12,
  },
  deleteButton: {
    marginLeft: 12,
    padding: 4,
  },
  checkButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkButtonActive: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  footer: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  }
});
