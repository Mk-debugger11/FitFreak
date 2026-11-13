import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button, ModalOption, ModalSheet } from '../../components';
import { MUSCLE_LABELS, MuscleId } from '../../constants/muscles';
import { theme } from '../../theme';
import { CategoryExerciseItem } from '../../utils/exercise';

interface ExercisePickerModalProps {
  visible: boolean;
  category: string | null;
  exercises: CategoryExerciseItem[];
  onSelect: (exercise: CategoryExerciseItem) => void;
  onCreateCustom: () => void;
  onBack: () => void;
}

const formatMuscleSummary = (
  primary: readonly MuscleId[],
  secondary: readonly MuscleId[],
): string | undefined => {
  const parts: string[] = [];
  if (primary.length > 0) {
    parts.push(`Main: ${primary.map((id) => MUSCLE_LABELS[id]).join(', ')}`);
  }
  if (secondary.length > 0) {
    parts.push(`Supporting: ${secondary.map((id) => MUSCLE_LABELS[id]).join(', ')}`);
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
};

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
        subtitle={formatMuscleSummary(exercise.primaryMuscles, exercise.secondaryMuscles)}
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
