import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Input, ModalSheet } from '../../components';
import { theme } from '../../theme';
import { DEFAULT_EQUIPMENT_TYPE, EQUIPMENT_TYPES, EquipmentType } from '../../types';

interface CustomExerciseModalProps {
  visible: boolean;
  onStart: (name: string, equipmentType: EquipmentType) => void;
  onCancel: () => void;
}

/** Creates an exercise the catalogue doesn't have, then starts it. */
export const CustomExerciseModal: React.FC<CustomExerciseModalProps> = ({
  visible,
  onStart,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [equipmentType, setEquipmentType] = useState<EquipmentType>(DEFAULT_EQUIPMENT_TYPE);

  // The form is cleared on the way out, so it never reopens with stale input.
  const reset = () => {
    setName('');
    setEquipmentType(DEFAULT_EQUIPMENT_TYPE);
  };

  const handleStart = () => {
    if (!name.trim()) return;
    onStart(name.trim(), equipmentType);
    reset();
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  return (
    <ModalSheet
      visible={visible}
      title="New Custom Exercise"
      footer={
        <>
          <Button title="Start Workout" onPress={handleStart} />
          <Button
            title="Cancel"
            variant="outline"
            onPress={handleCancel}
            style={{ marginTop: 8 }}
          />
        </>
      }
    >
      <Input placeholder="Exercise Name" value={name} onChangeText={setName} autoFocus />
      <Text style={styles.label}>Equipment Type:</Text>
      <View style={styles.equipmentRow}>
        {EQUIPMENT_TYPES.map((type) => (
          <Chip
            key={type}
            label={type}
            variant="option"
            selected={equipmentType === type}
            onPress={() => setEquipmentType(type)}
          />
        ))}
      </View>
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  label: {
    marginBottom: 8,
    color: theme.colors.text,
  },
  equipmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
});
