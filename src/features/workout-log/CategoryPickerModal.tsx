import React from 'react';
import { Button, ModalEmptyText, ModalOption, ModalSheet } from '../../components';

interface CategoryPickerModalProps {
  visible: boolean;
  /** The muscle groups targeted on the selected day. */
  categories: string[];
  onSelect: (category: string) => void;
  onSelectMixed: () => void;
  onCancel: () => void;
}

/** Step 1 of starting a workout: which muscle group is it for? */
export const CategoryPickerModal: React.FC<CategoryPickerModalProps> = ({
  visible,
  categories,
  onSelect,
  onSelectMixed,
  onCancel,
}) => (
  <ModalSheet
    visible={visible}
    title="Select Workout Category"
    scrollable
    footer={<Button title="Cancel" variant="outline" onPress={onCancel} style={{ marginTop: 16 }} />}
  >
    {categories.length > 0 ? (
      categories.map((category) => (
        <ModalOption key={category} label={category} onPress={() => onSelect(category)} />
      ))
    ) : (
      <ModalEmptyText>Add target muscles first!</ModalEmptyText>
    )}
    <ModalOption label="Mixed / Other" onPress={onSelectMixed} />
  </ModalSheet>
);
