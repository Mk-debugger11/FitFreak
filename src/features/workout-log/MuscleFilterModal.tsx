import React from 'react';
import { Button, ModalOption, ModalSheet } from '../../components';

interface MuscleFilterModalProps {
  visible: boolean;
  muscleGroups: string[];
  /** `null` means "All Muscles". */
  selected: string | null;
  onSelect: (muscleGroup: string | null) => void;
  onClose: () => void;
}

/** Narrows the day's list to one of its target muscle groups. */
export const MuscleFilterModal: React.FC<MuscleFilterModalProps> = ({
  visible,
  muscleGroups,
  selected,
  onSelect,
  onClose,
}) => (
  <ModalSheet
    visible={visible}
    title="Filter by Muscle Group"
    scrollable
    footer={<Button title="Close" variant="outline" onPress={onClose} style={{ marginTop: 16 }} />}
  >
    <ModalOption label="All Muscles" onPress={() => onSelect(null)} highlighted={selected === null} />
    {muscleGroups.map((muscleGroup) => (
      <ModalOption
        key={muscleGroup}
        label={muscleGroup}
        onPress={() => onSelect(muscleGroup)}
        highlighted={selected === muscleGroup}
      />
    ))}
  </ModalSheet>
);
