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
  onDelete: () => void;
}

export const SetRow: React.FC<SetRowProps> = ({
  set,
  index,
  equipmentType,
  onChange,
  onToggleComplete,
  onDelete,
}) => (
  <View style={[styles.row, set.completed && styles.rowCompleted]}>
    <Text style={styles.label} numberOfLines={1}>
      Set {index + 1}
    </Text>

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
        <Check color={set.completed ? '#000' : '#FFF'} size={16} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
        <Trash2 color={theme.colors.danger} size={20} />
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceHighlight,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  rowCompleted: {
    opacity: 0.6,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.md,
    width: 48,
    flexShrink: 0,
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
    minWidth: 44,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  unit: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    marginLeft: 4,
    marginRight: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 68,
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
    marginLeft: 8,
    padding: 4,
  },
});
