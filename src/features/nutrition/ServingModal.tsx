import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Input, ModalSheet } from '../../components';
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
  const [quantityText, setQuantityText] = useState('100');

  // Custom macro editing state (prominently available for cooked food items)
  const [isCustomMacrosActive, setIsCustomMacrosActive] = useState(false);
  const [hasManuallyEditedMacros, setHasManuallyEditedMacros] = useState(false);
  const [customCalories, setCustomCalories] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customFat, setCustomFat] = useState('');

  const basisInfo = food ? BASIS_UNITS[food.basis] : { unit: 'g', amount: 100 };
  const isPerPiece = food?.basis === 'per_piece';
  const isPer100ml = food?.basis === 'per_100ml';

  const isCookedDish = Boolean(
    food?.category === 'Cooked Dishes' ||
    (food?.name &&
      /cooked|curry|sabzi|dal|boiled|fried|roast|bhurji|khichdi|paneer tikka|dosa|pulao|biryani|tadka|gravy|chapati|roti|rice/i.test(
        food.name,
      )),
  );

  // Initialize form state whenever modal opens or food/entry changes
  useEffect(() => {
    if (visible) {
      if (editingEntry) {
        setQuantityText(String(editingEntry.quantity));

        const standardScaled = food ? scaleMacros(food, editingEntry.quantity) : null;
        const isOverridden = Boolean(
          isCookedDish ||
          (standardScaled &&
            (Math.abs(standardScaled.calories - editingEntry.macros.calories) > 1 ||
              Math.abs(standardScaled.protein - editingEntry.macros.protein) > 0.5 ||
              Math.abs(standardScaled.carbs - editingEntry.macros.carbs) > 0.5 ||
              Math.abs(standardScaled.fat - editingEntry.macros.fat) > 0.5)),
        );

        setIsCustomMacrosActive(isCookedDish || isOverridden);
        setHasManuallyEditedMacros(isOverridden);
        setCustomCalories(String(Math.round(editingEntry.macros.calories)));
        setCustomProtein(String(editingEntry.macros.protein));
        setCustomCarbs(String(editingEntry.macros.carbs));
        setCustomFat(String(editingEntry.macros.fat));
      } else if (food) {
        const defaultQty = food.basis === 'per_piece' ? 1 : 100;
        setQuantityText(String(defaultQty));

        const initialScaled = scaleMacros(food, defaultQty);
        setCustomCalories(String(Math.round(initialScaled.calories)));
        setCustomProtein(String(initialScaled.protein));
        setCustomCarbs(String(initialScaled.carbs));
        setCustomFat(String(initialScaled.fat));

        // Cooked food items have macro editing active right away
        setIsCustomMacrosActive(isCookedDish);
        setHasManuallyEditedMacros(false);
      } else {
        setQuantityText('100');
        setIsCustomMacrosActive(false);
        setHasManuallyEditedMacros(false);
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
    ? 'Enter Quantity (pieces)'
    : isPer100ml
    ? 'Enter Volume (ml)'
    : 'Enter Weight (grams)';

  const quantityPlaceholder = isPerPiece ? 'e.g. 1, 2, 3' : isPer100ml ? 'e.g. 200' : 'e.g. 150';

  const quantityError =
    quantityText.trim().length > 0 && !isQuantityValid
      ? `Please enter a valid ${isPerPiece ? 'quantity' : 'weight'} between 1 and 5,000`
      : undefined;

  // Live scaled macros based on base catalog/custom definition
  const scaledMacros = useMemo(() => {
    if (!food || !isQuantityValid) return null;
    return scaleMacros(food, parsedQuantity);
  }, [food, isQuantityValid, parsedQuantity]);

  // When quantity or weight changes, auto-scale macros if not manually overridden
  const handleQuantityChange = (text: string) => {
    setQuantityText(text);
    const num = parseFloat(text.trim());
    if (food && !isNaN(num) && num > 0 && !hasManuallyEditedMacros) {
      const nextScaled = scaleMacros(food, num);
      setCustomCalories(String(Math.round(nextScaled.calories)));
      setCustomProtein(String(nextScaled.protein));
      setCustomCarbs(String(nextScaled.carbs));
      setCustomFat(String(nextScaled.fat));
    }
  };

  const handleCustomMacroChange = (
    field: 'calories' | 'protein' | 'carbs' | 'fat',
    value: string,
  ) => {
    setHasManuallyEditedMacros(true);
    if (field === 'calories') setCustomCalories(value);
    if (field === 'protein') setCustomProtein(value);
    if (field === 'carbs') setCustomCarbs(value);
    if (field === 'fat') setCustomFat(value);
  };

  const handleResetToStandardMacros = () => {
    setHasManuallyEditedMacros(false);
    if (scaledMacros) {
      setCustomCalories(String(Math.round(scaledMacros.calories)));
      setCustomProtein(String(scaledMacros.protein));
      setCustomCarbs(String(scaledMacros.carbs));
      setCustomFat(String(scaledMacros.fat));
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
      setHasManuallyEditedMacros(false);
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
    if (isCustomMacrosActive && hasManuallyEditedMacros && displayMacros) {
      onSave(parsedQuantity, undefined, displayMacros);
    } else {
      onSave(parsedQuantity, undefined, undefined);
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
      {/* Primary Input: Select Quantity or Weight */}
      <View style={styles.inputSection}>
        <Input
          label={quantityLabel}
          placeholder={quantityPlaceholder}
          keyboardType="decimal-pad"
          value={quantityText}
          onChangeText={handleQuantityChange}
          error={quantityError}
          autoFocus
        />
        <Text style={styles.inputHelperText}>
          {isPerPiece
            ? 'Enter exact number of pieces. Nutrition calculates dynamically.'
            : isPer100ml
            ? 'Enter exact volume in ml. Nutrition calculates dynamically.'
            : 'Enter exact weight in grams. Nutrition calculates dynamically.'}
        </Text>
      </View>

      {/* Cooked Dish Preparation / Editable Macros */}
      {isCookedDish ? (
        <View style={styles.cookedSection}>
          <View style={styles.cookedHeader}>
            <View style={styles.cookedTitleGroup}>
              <Text style={styles.cookedTitle}>Cooked Dish Macros (Editable)</Text>
              <Text style={styles.cookedSubtitle}>
                Oil, spices, and water vary. Adjust the macros below for your recipe:
              </Text>
            </View>
            {hasManuallyEditedMacros && (
              <TouchableOpacity
                onPress={handleResetToStandardMacros}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.macroInputsRow}>
            <View style={styles.macroInputHalf}>
              <Input
                label="Calories (kcal)"
                placeholder="kcal"
                keyboardType="decimal-pad"
                value={customCalories}
                onChangeText={(v) => handleCustomMacroChange('calories', v)}
              />
            </View>
            <View style={styles.macroInputHalf}>
              <Input
                label="Protein (g)"
                placeholder="g"
                keyboardType="decimal-pad"
                value={customProtein}
                onChangeText={(v) => handleCustomMacroChange('protein', v)}
              />
            </View>
          </View>

          <View style={styles.macroInputsRow}>
            <View style={styles.macroInputHalf}>
              <Input
                label="Carbs (g)"
                placeholder="g"
                keyboardType="decimal-pad"
                value={customCarbs}
                onChangeText={(v) => handleCustomMacroChange('carbs', v)}
              />
            </View>
            <View style={styles.macroInputHalf}>
              <Input
                label="Fat (g)"
                placeholder="g"
                keyboardType="decimal-pad"
                value={customFat}
                onChangeText={(v) => handleCustomMacroChange('fat', v)}
              />
            </View>
          </View>
        </View>
      ) : (
        /* Non-cooked items: option to customize macros */
        <View style={styles.macroOptionSection}>
          <View style={styles.macroOptionHeader}>
            <Text style={styles.macroOptionTitle}>Custom Nutrition</Text>
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
                {isCustomMacrosActive ? 'Hide Edit' : 'Edit Macros'}
              </Text>
            </TouchableOpacity>
          </View>

          {isCustomMacrosActive && (
            <View style={styles.customMacroFieldsCard}>
              <View style={styles.customMacroFieldsHeader}>
                <Text style={styles.customMacroFieldsTitle}>
                  Edit Portion Macros ({parsedQuantity || 0} {basisInfo.unit})
                </Text>
                {hasManuallyEditedMacros && (
                  <TouchableOpacity onPress={handleResetToStandardMacros}>
                    <Text style={styles.resetButtonText}>Reset</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.macroInputsRow}>
                <View style={styles.macroInputHalf}>
                  <Input
                    label="Calories (kcal)"
                    placeholder="kcal"
                    keyboardType="decimal-pad"
                    value={customCalories}
                    onChangeText={(v) => handleCustomMacroChange('calories', v)}
                  />
                </View>
                <View style={styles.macroInputHalf}>
                  <Input
                    label="Protein (g)"
                    placeholder="g"
                    keyboardType="decimal-pad"
                    value={customProtein}
                    onChangeText={(v) => handleCustomMacroChange('protein', v)}
                  />
                </View>
              </View>

              <View style={styles.macroInputsRow}>
                <View style={styles.macroInputHalf}>
                  <Input
                    label="Carbs (g)"
                    placeholder="g"
                    keyboardType="decimal-pad"
                    value={customCarbs}
                    onChangeText={(v) => handleCustomMacroChange('carbs', v)}
                  />
                </View>
                <View style={styles.macroInputHalf}>
                  <Input
                    label="Fat (g)"
                    placeholder="g"
                    keyboardType="decimal-pad"
                    value={customFat}
                    onChangeText={(v) => handleCustomMacroChange('fat', v)}
                  />
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Live Nutrition Summary Box */}
      {displayMacros ? (
        <View style={styles.previewBox}>
          <View style={styles.previewHeaderRow}>
            <Text style={styles.previewTitle}>
              Total Nutrition ({parsedQuantity || 0} {basisInfo.unit})
            </Text>
            {hasManuallyEditedMacros && (
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
  inputSection: {
    marginBottom: theme.spacing.md,
  },
  inputHelperText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    marginTop: -theme.spacing.xs + 2,
    marginBottom: theme.spacing.xs,
  },
  cookedSection: {
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cookedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  cookedTitleGroup: {
    flex: 1,
  },
  cookedTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
  },
  cookedSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    marginTop: 2,
    lineHeight: 16,
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
  },
  macroOptionTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  macroToggleBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 5,
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
