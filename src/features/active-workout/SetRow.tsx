import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Check, Trash2 } from 'lucide-react-native';
import { theme } from '../../theme';
import { EquipmentType, WorkoutSet } from '../../types';

interface SetRowProps {
  set: WorkoutSet;
  index: number;
  equipmentType?: EquipmentType;
  onChange: (weight: number, reps: number) => void;
  onToggleComplete: () => void;
  onToggleWarmup: () => void;
  onDelete: () => void;
}

/** Editable row for a single set during an active workout, with an explicit warm-up toggle. */
export const SetRow: React.FC<SetRowProps> = ({
  set,
  index,
  equipmentType,
  onChange,
  onToggleComplete,
  onToggleWarmup,
  onDelete,
}) => {
  const isWarmup = set.isWarmup === true;

  return (
    <View style={[styles.row, isWarmup && styles.rowWarmup, set.completed && styles.rowCompleted]}>
      <View style={styles.labelGroup}>
        <Text style={[styles.label, isWarmup && styles.labelWarmup]} numberOfLines={1}>
          Set {index + 1}
        </Text>
        <TouchableOpacity
          style={[styles.warmupPill, isWarmup && styles.warmupPillActive]}
          onPress={onToggleWarmup}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel={`Mark set ${index + 1} as ${isWarmup ? 'working set' : 'warm-up'}`}
          accessibilityState={{ selected: isWarmup }}
        >
          <Text style={[styles.warmupText, isWarmup && styles.warmupTextActive]}>W</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputGroup}>
        <TextInput
          style={styles.input}
          value={set.weight.toString()}
          onChangeText={(text) => onChange(parseFloat(text) || 0, set.reps)}
          keyboardType="numeric"
        />
        <Text style={styles.unit} numberOfLines={1}>
          {equipmentType === 'dumbbell' ? 'kg/hand' : 'kg'}
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <TextInput
          style={styles.input}
          value={set.reps.toString()}
          onChangeText={(text) => onChange(set.weight, parseInt(text, 10) || 0)}
          keyboardType="numeric"
        />
        <Text style={styles.unit}>reps</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.checkButton, set.completed && styles.checkButtonActive]}
          onPress={onToggleComplete}
        >
          <Check color={set.completed ? theme.colors.background : theme.colors.text} size={16} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
          <Trash2 color={theme.colors.danger} size={20} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: theme.colors.surfaceHighlight,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  rowWarmup: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  rowCompleted: {
    opacity: 0.6,
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    marginRight: theme.spacing.xs,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    minWidth: 38,
  },
  labelWarmup: {
    color: theme.colors.textSecondary,
  },
  warmupPill: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    marginLeft: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warmupPillActive: {
    backgroundColor: theme.colors.surfaceHighlight,
    borderColor: theme.colors.primary,
  },
  warmupText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
  },
  warmupTextActive: {
    color: theme.colors.primary,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  input: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 40,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  unit: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    marginLeft: 4,
    marginRight: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 66,
    flexShrink: 0,
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
  deleteButton: {
    marginLeft: 6,
    padding: 4,
  },
});
