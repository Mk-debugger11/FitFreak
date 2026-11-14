import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Chip, Input, ModalSheet } from '../../components';
import { BASIS_UNITS } from '../../constants/nutrition';
import { theme } from '../../theme';
import { CustomFood, FoodItem, LoggedFood, MacroNutrients, MEAL_LABELS, MealType } from '../../types';
import { formatCalories, formatGrams } from '../../utils/format';
import { scaleMacros } from './servingMath';

export interface ServingModalProps {
  visible: boolean;
  food: FoodItem | CustomFood | null;
  editingEntry?: LoggedFood | null;
  mealType?: MealType | null;
  onSave: (
    quantity: number,
    servingLabel?: string,
    customMacros?: MacroNutrients,
  ) => void;
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

  // Custom macro editing state (for cooked dishes / custom preparations)
  const [isCustomMacrosActive, setIsCustomMacrosActive] = useState(false);
  const [customCalories, setCustomCalories] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customFat, setCustomFat] = useState('');

  const basisInfo = food ? BASIS_UNITS[food.basis] : { unit: 'g', amount: 100 };
  const isPerPiece = food?.basis === 'per_piece';
  const isPer100ml = food?.basis === 'per_100ml';

  const isCookedDish = Boolean(
    food?.category === 'Cooked Dishes' ||
    (food?.name && /cooked|curry|sabzi|dal|boiled|fried|roast|bhurji|khichdi|paneer tikka|dosa|pulao|biryani/i.test(food.name)),
  );

  // Initialize form state
  useEffect(() => {
    if (visible) {
      if (editingEntry) {
        setQuantityText(String(editingEntry.quantity));
        setServingLabel(editingEntry.servingLabel);

        const standardScaled = food ? scaleMacros(food, editingEntry.quantity) : null;
        const isOverridden = Boolean(
          isCookedDish ||
          (standardScaled &&
            (Math.abs(standardScaled.calories - editingEntry.macros.calories) > 1 ||
              Math.abs(standardScaled.protein - editingEntry.macros.protein) > 0.5 ||
              Math.abs(standardScaled.carbs - editingEntry.macros.carbs) > 0.5 ||
              Math.abs(standardScaled.fat - editingEntry.macros.fat) > 0.5)),
        );

        if (isOverridden) {
          setIsCustomMacrosActive(true);
          setCustomCalories(String(Math.round(editingEntry.macros.calories)));
          setCustomProtein(String(editingEntry.macros.protein));
          setCustomCarbs(String(editingEntry.macros.carbs));
          setCustomFat(String(editingEntry.macros.fat));
        } else {
          setIsCustomMacrosActive(false);
          setCustomCalories('');
          setCustomProtein('');
          setCustomCarbs('');
          setCustomFat('');
        }
      } else if (food) {
        const defaultQty =
          food.defaultQuantity ?? (food.basis === 'per_piece' ? 1 : 100);
        setQuantityText(String(defaultQty));

        const matchedServing = food.servings?.find((s) => s.grams === defaultQty);
        setServingLabel(matchedServing?.label);
        setIsCustomMacrosActive(false);
        setCustomCalories('');
        setCustomProtein('');
        setCustomCarbs('');
        setCustomFat('');
      } else {
        setQuantityText('100');
        setServingLabel(undefined);
        setIsCustomMacrosActive(false);
        setCustomCalories('');
        setCustomProtein('');
        setCustomCarbs('');
        setCustomFat('');
      }
    }
  }, [visible, food, editingEntry, isCookedDish]);

  const parsedQuantity = parseFloat(quantityText.trim());
  const isQuantityValid =
    !isNaN(parsedQuantity) && parsedQuantity > 0 && parsedQuantity <= 5000;

  const quantityLabel = isPerPiece
    ? 'Quantity (pieces)'
    : isPer100ml
    ? 'Volume (ml)'
    : 'Weight (grams)';

  const quantityPlaceholder = isPerPiece ? 'e.g. 2' : isPer100ml ? 'e.g. 250' : 'e.g. 150';

  const quantityError =
    quantityText.trim().length > 0 && !isQuantityValid
      ? `Please enter a valid ${isPerPiece ? 'quantity' : 'weight'} between 1 and 5,000`
      : undefined;

  // Live scaled macros from food definition
  const scaledMacros = useMemo(() => {
    if (!food || !isQuantityValid) return null;
    return scaleMacros(food, parsedQuantity);
  }, [food, isQuantityValid, parsedQuantity]);

  // When quantity changes, if custom macros are NOT active or newly toggling, keep them in sync
  const handleQuantityChange = (text: string) => {
    setQuantityText(text);
    const num = parseFloat(text.trim());
    if (food?.servings) {
      const match = food.servings.find((s) => s.grams === num);
      setServingLabel(match?.label);
    } else {
      setServingLabel(undefined);
    }

    // If custom macros were not manually altered, re-seed them for the new quantity
    if (isCustomMacrosActive && food && !isNaN(num) && num > 0) {
      const nextScaled = scaleMacros(food, num);
      setCustomCalories(String(Math.round(nextScaled.calories)));
      setCustomProtein(String(nextScaled.protein));
      setCustomCarbs(String(nextScaled.carbs));
      setCustomFat(String(nextScaled.fat));
    }
  };

  const handleSelectServing = (grams: number, label: string) => {
    setQuantityText(String(grams));
    setServingLabel(label);

    if (isCustomMacrosActive && food) {
      const nextScaled = scaleMacros(food, grams);
      setCustomCalories(String(Math.round(nextScaled.calories)));
      setCustomProtein(String(nextScaled.protein));
      setCustomCarbs(String(nextScaled.carbs));
      setCustomFat(String(nextScaled.fat));
    }
  };

  const handleToggleCustomMacros = () => {
    if (!isCustomMacrosActive) {
      if (scaledMacros) {
        setCustomCalories(String(Math.round(scaledMacros.calories)));
        setCustomProtein(String(scaledMacros.protein));
        setCustomCarbs(String(scaledMacros.carbs));
        setCustomFat(String(scaledMacros.fat));
      }
      setIsCustomMacrosActive(true);
    } else {
      setIsCustomMacrosActive(false);
    }
  };

  const handleResetToStandardMacros = () => {
    if (scaledMacros) {
      setCustomCalories(String(Math.round(scaledMacros.calories)));
      setCustomProtein(String(scaledMacros.protein));
      setCustomCarbs(String(scaledMacros.carbs));
      setCustomFat(String(scaledMacros.fat));
    }
  };

  const displayMacros: MacroNutrients | null = useMemo(() => {
    if (isCustomMacrosActive) {
      const cal = parseFloat(customCalories.trim());
      const p = parseFloat(customProtein.trim());
      const c = parseFloat(customCarbs.trim());
      const f = parseFloat(customFat.trim());
      return {
        calories: !isNaN(cal) && cal >= 0 ? cal : 0,
        protein: !isNaN(p) && p >= 0 ? p : 0,
        carbs: !isNaN(c) && c >= 0 ? c : 0,
        fat: !isNaN(f) && f >= 0 ? f : 0,
      };
    }
    return scaledMacros;
  }, [isCustomMacrosActive, customCalories, customProtein, customCarbs, customFat, scaledMacros]);

  const handleSave = () => {
    if (!isQuantityValid) return;
    if (isCustomMacrosActive && displayMacros) {
      onSave(parsedQuantity, servingLabel, displayMacros);
    } else {
      onSave(parsedQuantity, servingLabel, undefined);
    }
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
      {/* Portion presets as optional shortcuts (user is not constrained) */}
      {food?.servings && food.servings.length > 0 && (
        <View style={styles.servingsSection}>
          <Text style={styles.sectionLabel}>Quick Portions (Optional Shortcuts):</Text>
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

      {/* Primary User Input: Weight (g), Volume (ml), or Quantity (pieces) */}
      <View style={styles.inputSection}>
        <Input
          label={quantityLabel}
          placeholder={quantityPlaceholder}
          keyboardType="decimal-pad"
          value={quantityText}
          onChangeText={handleQuantityChange}
          error={quantityError}
        />
        <Text style={styles.inputHelperText}>
          {isPerPiece
            ? 'Enter exact piece count. Macros update automatically.'
            : isPer100ml
            ? 'Enter exact volume in ml. Macros scale automatically.'
            : 'Enter exact weight in grams. Macros scale automatically.'}
        </Text>
      </View>

      {/* Option to Edit Macros (especially prominent for Cooked Food Items) */}
      <View style={styles.macroOptionSection}>
        <View style={styles.macroOptionHeader}>
          <View style={styles.macroOptionLabelGroup}>
            <Text style={styles.macroOptionTitle}>
              {isCookedDish ? 'Cooked Dish Preparation' : 'Custom Nutrition'}
            </Text>
            <Text style={styles.macroOptionSubtitle}>
              {isCookedDish
                ? 'Cooking oils, water absorption, and spices vary. You can edit the macros.'
                : 'Fine-tune or override macros for this portion.'}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.macroToggleBtn,
              isCustomMacrosActive && styles.macroToggleBtnActive,
            ]}
            onPress={handleToggleCustomMacros}
          >
            <Text
              style={[
                styles.macroToggleBtnText,
                isCustomMacrosActive && styles.macroToggleBtnTextActive,
              ]}
            >
              {isCustomMacrosActive ? 'Custom ON' : 'Edit Macros'}
            </Text>
          </TouchableOpacity>
        </View>

        {isCustomMacrosActive && (
          <View style={styles.customMacroFieldsCard}>
            <View style={styles.customMacroFieldsHeader}>
              <Text style={styles.customMacroFieldsTitle}>
                Edit Portion Macros ({parsedQuantity || 0} {basisInfo.unit})
              </Text>
              <TouchableOpacity onPress={handleResetToStandardMacros}>
                <Text style={styles.resetButtonText}>Reset to Standard</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.macroInputsRow}>
              <View style={styles.macroInputHalf}>
                <Input
                  label="Calories (kcal)"
                  placeholder="e.g. 220"
                  keyboardType="decimal-pad"
                  value={customCalories}
                  onChangeText={setCustomCalories}
                />
              </View>
              <View style={styles.macroInputHalf}>
                <Input
                  label="Protein (g)"
                  placeholder="e.g. 15"
                  keyboardType="decimal-pad"
                  value={customProtein}
                  onChangeText={setCustomProtein}
                />
              </View>
            </View>

            <View style={styles.macroInputsRow}>
              <View style={styles.macroInputHalf}>
                <Input
                  label="Carbs (g)"
                  placeholder="e.g. 28"
                  keyboardType="decimal-pad"
                  value={customCarbs}
                  onChangeText={setCustomCarbs}
                />
              </View>
              <View style={styles.macroInputHalf}>
                <Input
                  label="Fat (g)"
                  placeholder="e.g. 6"
                  keyboardType="decimal-pad"
                  value={customFat}
                  onChangeText={setCustomFat}
                />
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Live Nutrition Display */}
      {displayMacros ? (
        <View style={styles.previewBox}>
          <View style={styles.previewHeaderRow}>
            <Text style={styles.previewTitle}>Nutrition for this portion</Text>
            {isCustomMacrosActive && (
              <View style={styles.customBadge}>
                <Text style={styles.customBadgeText}>Customized</Text>
              </View>
            )}
          </View>
          <View style={styles.previewContent}>
            <Text style={styles.previewCalories}>
              {formatCalories(displayMacros.calories)} kcal
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
                  P: {formatGrams(displayMacros.protein)}
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
                  C: {formatGrams(displayMacros.carbs)}
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
                  F: {formatGrams(displayMacros.fat)}
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
    marginBottom: theme.spacing.sm,
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
  inputSection: {
    marginBottom: theme.spacing.md,
  },
  inputHelperText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    marginTop: -theme.spacing.xs + 2,
    marginBottom: theme.spacing.xs,
  },
  macroOptionSection: {
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  macroOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  macroOptionLabelGroup: {
    flex: 1,
  },
  macroOptionTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
  },
  macroOptionSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    marginTop: 2,
  },
  macroToggleBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: 'transparent',
  },
  macroToggleBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  macroToggleBtnText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
  },
  macroToggleBtnTextActive: {
    color: theme.colors.onPrimary,
  },
  customMacroFieldsCard: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: theme.spacing.xs,
  },
  customMacroFieldsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  customMacroFieldsTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  resetButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
  },
  macroInputsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  macroInputHalf: {
    flex: 1,
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
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  previewTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: theme.typography.weights.semibold,
  },
  customBadge: {
    backgroundColor: theme.colors.primary + '22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary + '55',
  },
  customBadgeText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
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
