import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Input, ModalSheet, SegmentedControl, SegmentedOption } from '../../components';
import { FOOD_CATEGORIES, FoodCategory } from '../../constants/nutrition';
import { theme } from '../../theme';
import { CustomFood, FoodBasis } from '../../types';
import { useNutritionStore } from '../../store/nutritionStore';

interface CustomFoodModalProps {
  visible: boolean;
  onCreated: (food: CustomFood) => void;
  onClose: () => void;
}

const BASIS_OPTIONS: readonly SegmentedOption<FoodBasis>[] = [
  { value: 'per_100g', label: '100g' },
  { value: 'per_100ml', label: '100ml' },
  { value: 'per_piece', label: '1 Piece' },
];

export const CustomFoodModal: React.FC<CustomFoodModalProps> = ({
  visible,
  onCreated,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FoodCategory>('Other');
  const [basis, setBasis] = useState<FoodBasis>('per_100g');
  const [proteinText, setProteinText] = useState('');
  const [carbsText, setCarbsText] = useState('');
  const [fatText, setFatText] = useState('');
  const [caloriesText, setCaloriesText] = useState('');
  const [isCaloriesManuallyEdited, setIsCaloriesManuallyEdited] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setCategory('Other');
    setBasis('per_100g');
    setProteinText('');
    setCarbsText('');
    setFatText('');
    setCaloriesText('');
    setIsCaloriesManuallyEdited(false);
    setDuplicateError(null);
  };

  useEffect(() => {
    if (!visible) {
      reset();
    }
  }, [visible]);

  // Recalculate auto calories from 4/4/9 when macros change
  const updateMacrosAndAutoCalories = (pStr: string, cStr: string, fStr: string) => {
    if (!isCaloriesManuallyEdited) {
      const p = parseFloat(pStr) || 0;
      const c = parseFloat(cStr) || 0;
      const f = parseFloat(fStr) || 0;
      const autoCal = Math.round(p * 4 + c * 4 + f * 9);
      setCaloriesText(pStr || cStr || fStr ? String(autoCal) : '');
    }
  };

  const handleProteinChange = (text: string) => {
    setProteinText(text);
    updateMacrosAndAutoCalories(text, carbsText, fatText);
  };

  const handleCarbsChange = (text: string) => {
    setCarbsText(text);
    updateMacrosAndAutoCalories(proteinText, text, fatText);
  };

  const handleFatChange = (text: string) => {
    setFatText(text);
    updateMacrosAndAutoCalories(proteinText, carbsText, text);
  };

  const handleCaloriesChange = (text: string) => {
    setIsCaloriesManuallyEdited(true);
    setCaloriesText(text);
  };

  // Validation
  const isNameValid = name.trim().length > 0;
  const pNum = parseFloat(proteinText.trim()) || 0;
  const cNum = parseFloat(carbsText.trim()) || 0;
  const fNum = parseFloat(fatText.trim()) || 0;
  const calNum = parseFloat(caloriesText.trim()) || 0;

  const isFormValid =
    isNameValid &&
    !isNaN(pNum) &&
    pNum >= 0 &&
    !isNaN(cNum) &&
    cNum >= 0 &&
    !isNaN(fNum) &&
    fNum >= 0 &&
    !isNaN(calNum) &&
    calNum >= 0;

  const basisLabel =
    basis === 'per_piece'
      ? 'per piece'
      : basis === 'per_100ml'
      ? 'per 100ml'
      : 'per 100g';

  const handleSave = () => {
    if (!isFormValid) return;
    setDuplicateError(null);

    const addCustomFood = useNutritionStore.getState().addCustomFood;
    const newFood = addCustomFood({
      name: name.trim(),
      category,
      basis,
      macros: {
        calories: calNum,
        protein: pNum,
        carbs: cNum,
        fat: fNum,
      },
    });

    if (!newFood) {
      setDuplicateError('A food with this name already exists.');
      return;
    }

    reset();
    onCreated(newFood);
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  return (
    <ModalSheet
      visible={visible}
      title="Create Custom Food"
      scrollable
      footer={
        <View style={styles.footerContainer}>
          <Button
            title="Create & Log Food"
            onPress={handleSave}
            disabled={!isFormValid}
          />
          <Button
            title="Cancel"
            variant="outline"
            onPress={handleCancel}
            style={{ marginTop: 8 }}
          />
        </View>
      }
    >
      <Input
        label="Food Name"
        placeholder="e.g. Grandma's Roti, Protein Shake"
        value={name}
        onChangeText={(val) => {
          setName(val);
          if (duplicateError) setDuplicateError(null);
        }}
        error={duplicateError ?? undefined}
        autoFocus
      />

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Category</Text>
        <View style={styles.chipGrid}>
          {FOOD_CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              variant="option"
              selected={category === cat}
              onPress={() => setCategory(cat)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Portion Basis</Text>
        <SegmentedControl options={BASIS_OPTIONS} value={basis} onChange={setBasis} />
      </View>

      <View style={styles.macrosSection}>
        <Text style={styles.sectionLabel}>Nutrients ({basisLabel})</Text>

        <View style={styles.macroInputsGrid}>
          <Input
            label="Protein (g)"
            placeholder="0"
            keyboardType="numeric"
            value={proteinText}
            onChangeText={handleProteinChange}
            containerStyle={styles.macroInputCol}
          />
          <Input
            label="Carbs (g)"
            placeholder="0"
            keyboardType="numeric"
            value={carbsText}
            onChangeText={handleCarbsChange}
            containerStyle={styles.macroInputCol}
          />
        </View>

        <View style={styles.macroInputsGrid}>
          <Input
            label="Fat (g)"
            placeholder="0"
            keyboardType="numeric"
            value={fatText}
            onChangeText={handleFatChange}
            containerStyle={styles.macroInputCol}
          />
          <Input
            label="Calories (kcal)"
            placeholder="0"
            keyboardType="numeric"
            value={caloriesText}
            onChangeText={handleCaloriesChange}
            containerStyle={styles.macroInputCol}
          />
        </View>
      </View>
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: theme.spacing.md,
  },
  sectionLabel: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    marginBottom: theme.spacing.xs,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  macrosSection: {
    marginBottom: theme.spacing.sm,
  },
  macroInputsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  macroInputCol: {
    flex: 1,
  },
  footerContainer: {
    marginTop: theme.spacing.sm,
  },
});

