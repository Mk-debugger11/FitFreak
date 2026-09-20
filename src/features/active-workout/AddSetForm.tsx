import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Card, Input } from '../../components';
import { theme } from '../../theme';

interface AddSetFormProps {
  onAddSet: (weight: number, reps: number) => void;
}

export const AddSetForm: React.FC<AddSetFormProps> = ({ onAddSet }) => {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  const handleAdd = () => {
    if (!weight || !reps) return;
    onAddSet(parseFloat(weight), parseInt(reps, 10));
    setWeight('');
    setReps('');
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Add Set</Text>
      <View style={styles.row}>
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
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Plus color={theme.colors.onPrimary} size={24} />
        </TouchableOpacity>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    marginBottom: theme.spacing.sm,
  },
  row: {
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
});
