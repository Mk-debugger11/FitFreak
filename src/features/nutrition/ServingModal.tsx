import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Input, ModalSheet } from '../../components';
import { BASIS_UNITS } from '../../constants/nutrition';
import { theme } from '../../theme';
import { CustomFood, FoodItem, LoggedFood, MEAL_LABELS, MealType } from '../../types';
import { formatCalories, formatGrams } from '../../utils/format';
import { scaleMacros } from './servingMath';

interface ServingModalProps {
  visible: boolean;
  food: FoodItem | CustomFood | null;
  editingEntry?: LoggedFood | null;
  mealType?: MealType | null;
  onSave: (quantity: number, servingLabel?: string) => void;
  onClose: () => void;
}

export const ServingModal: React.FC<ServingModalProps> = ({
  visible,
  food,
  editingEntry,
  mealType,
  onSave,
  onClose,
}) => {
  const [quantityText, setQuantityText] = useState('');
  const [servingLabel, setServingLabel] = useState<string | undefined>(undefined);

  // Initialize form state
  useEffect(() => {
    if (visible) {
      if (editingEntry) {
        setQuantityText(String(editingEntry.quantity));
        setServingLabel(editingEntry.servingLabel);
      } else if (food) {
        const defaultQty =
          food.defaultQuantity ?? (food.basis === 'per_piece' ? 1 : 100);
        setQuantityText(String(defaultQty));

        const matchedServing = food.servings?.find((s) => s.grams === defaultQty);
        setServingLabel(matchedServing?.label);
      } else {
        setQuantityText('100');
        setServingLabel(undefined);
      }
    }
  }, [visible, food, editingEntry]);

  const basisInfo = food ? BASIS_UNITS[food.basis] : { unit: 'g', amount: 100 };

  const parsedQuantity = parseFloat(quantityText.trim());
  const isQuantityValid =
    !isNaN(parsedQuantity) && parsedQuantity > 0 && parsedQuantity <= 5000;

  const quantityError =
    quantityText.trim().length > 0 && !isQuantityValid
      ? 'Quantity must be between 1 and 5,000'
      : undefined;

  // Live scaled macros preview
  const scaledMacros = useMemo(() => {
    if (!food || !isQuantityValid) return null;
    return scaleMacros(food, parsedQuantity);
  }, [food, isQuantityValid, parsedQuantity]);

  const handleQuantityChange = (text: string) => {
    setQuantityText(text);
    const num = parseFloat(text.trim());
    if (food?.servings) {
      const match = food.servings.find((s) => s.grams === num);
      setServingLabel(match?.label);
    } else {
      setServingLabel(undefined);
    }
  };

  const handleSelectServing = (grams: number, label: string) => {
    setQuantityText(String(grams));
    setServingLabel(label);
  };

  const handleSave = () => {
    if (!isQuantityValid) return;
    onSave(parsedQuantity, servingLabel);
  };

  const modalTitle = editingEntry
    ? `Edit ${food?.name ?? editingEntry.foodName}`
    : (food?.name ?? 'Serving Details');

  const actionTitle = editingEntry
    ? 'Save Changes'
    : mealType
    ? `Add to ${MEAL_LABELS[mealType]}`
    : 'Add to Meal';

  return (
    <ModalSheet
      visible={visible}
      title={modalTitle}
      scrollable
      footer={
        <View style={styles.footerContainer}>
          <Button
            title={actionTitle}
            onPress={handleSave}
            disabled={!isQuantityValid}
          />
          <Button
            title="Cancel"
            variant="outline"
            onPress={onClose}
            style={{ marginTop: 8 }}
          />
        </View>
      }
    >
      {/* Named Portion Chips if available */}
      {food?.servings && food.servings.length > 0 && (
        <View style={styles.servingsSection}>
          <Text style={styles.sectionLabel}>Portions:</Text>
          <View style={styles.chipRow}>
            {food.servings.map((serving) => {
              const isSelected =
                servingLabel === serving.label ||
                parsedQuantity === serving.grams;
              return (
                <Chip
                  key={serving.label}
                  label={`${serving.label} (${serving.grams}${basisInfo.unit})`}
                  variant="option"
                  selected={isSelected}
                  onPress={() => handleSelectServing(serving.grams, serving.label)}
                />
              );
            })}
          </View>
        </View>
      )}

      {/* Numeric Quantity Input */}
      <Input
        label={`Quantity (${basisInfo.unit})`}
        placeholder={`e.g. ${basisInfo.amount}`}
        keyboardType="numeric"
        value={quantityText}
        onChangeText={handleQuantityChange}
        error={quantityError}
      />

      {/* Live Macro Preview */}
      {scaledMacros ? (
        <View style={styles.previewBox}>
          <Text style={styles.previewTitle}>Nutrition for this portion</Text>
          <View style={styles.previewContent}>
            <Text style={styles.previewCalories}>
              {formatCalories(scaledMacros.calories)} kcal
            </Text>
            <View style={styles.previewMacrosRow}>
              <View style={styles.macroPill}>
                <View
                  style={[
                    styles.macroDot,
                    { backgroundColor: theme.colors.nutrition.protein },
                  ]}
                />
                <Text style={styles.macroPillText}>
                  P: {formatGrams(scaledMacros.protein)}
                </Text>
              </View>
              <View style={styles.macroPill}>
                <View
                  style={[
                    styles.macroDot,
                    { backgroundColor: theme.colors.nutrition.carbs },
                  ]}
                />
                <Text style={styles.macroPillText}>
                  C: {formatGrams(scaledMacros.carbs)}
                </Text>
              </View>
              <View style={styles.macroPill}>
                <View
                  style={[
                    styles.macroDot,
                    { backgroundColor: theme.colors.nutrition.fat },
                  ]}
                />
                <Text style={styles.macroPillText}>
                  F: {formatGrams(scaledMacros.fat)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  servingsSection: {
    marginBottom: theme.spacing.md,
  },
  sectionLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    marginBottom: theme.spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  previewBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  previewTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: theme.typography.weights.semibold,
    marginBottom: theme.spacing.xs,
  },
  previewContent: {
    gap: theme.spacing.xs,
  },
  previewCalories: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
  },
  previewMacrosRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: 2,
  },
  macroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  macroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  macroPillText: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  footerContainer: {
    marginTop: theme.spacing.sm,
  },
});

