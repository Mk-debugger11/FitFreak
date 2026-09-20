import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button, ModalOption, ModalSheet } from '../../components';
import { theme } from '../../theme';
import { EquipmentType } from '../../types';

interface ExercisePickerModalProps {
  visible: boolean;
  category: string | null;
  exercises: { name: string; equipmentType: EquipmentType }[];
  onSelect: (exercise: { name: string; equipmentType: EquipmentType }) => void;
  onCreateCustom: () => void;
  onBack: () => void;
}

/** Step 2 of starting a workout: which exercise? */
export const ExercisePickerModal: React.FC<ExercisePickerModalProps> = ({
  visible,
  category,
  exercises,
  onSelect,
  onCreateCustom,
  onBack,
}) => (
  <ModalSheet
    visible={visible}
    title={`Select Exercise for ${category}`}
    scrollable
    footer={<Button title="Back" variant="outline" onPress={onBack} style={{ marginTop: 16 }} />}
  >
    {exercises.map((exercise, index) => (
      <ModalOption
        key={`${exercise.name}-${index}`}
        label={exercise.name}
        onPress={() => onSelect(exercise)}
        trailing={
          exercise.equipmentType ? (
            <Text style={styles.equipment}>{exercise.equipmentType}</Text>
          ) : null
        }
      />
    ))}
    <ModalOption label="+ Create Custom Exercise" onPress={onCreateCustom} highlighted />
  </ModalSheet>
);

const styles = StyleSheet.create({
  equipment: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    textTransform: 'capitalize',
  },
});
