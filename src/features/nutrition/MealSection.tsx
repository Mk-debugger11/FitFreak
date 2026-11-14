import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { MEAL_LABELS, MealType } from '../../types';
import { theme } from '../../theme';
import { LoggedFood, MacroNutrients } from '../../types';
import { formatCalories, formatGrams } from '../../utils/format';
import { FoodEntryRow } from './FoodEntryRow';

interface MealSectionProps {
  mealType: MealType;
  entries: LoggedFood[];
  totals: MacroNutrients;
  isFutureDate?: boolean;
  onAddFood: (mealType: MealType) => void;
  onEditEntry: (entry: LoggedFood) => void;
  onDeleteEntry: (id: string) => void;
}

export const MealSection: React.FC<MealSectionProps> = ({
  mealType,
  entries,
  totals,
  isFutureDate = false,
  onAddFood,
  onEditEntry,
  onDeleteEntry,
}) => {
  const mealTitle = MEAL_LABELS[mealType];
  const macroSummary = `P ${formatGrams(totals.protein)} / C ${formatGrams(
    totals.carbs,
  )} / F ${formatGrams(totals.fat)}`;

  return (
    <View style={styles.cardContainer}>
      {/* Section Header */}
      <View style={styles.header}>
        <View style={styles.headerTitles}>
          <View style={styles.titleRow}>
            <Text style={styles.mealTitle}>{mealTitle}</Text>
            <Text style={styles.caloriesBadge}>
              {formatCalories(totals.calories)} kcal
            </Text>
          </View>
          <Text style={styles.macroSummary}>{macroSummary}</Text>
        </View>

        <TouchableOpacity
          style={[styles.addButton, isFutureDate && styles.addButtonDisabled]}
          onPress={() => onAddFood(mealType)}
          disabled={isFutureDate}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`Add food to ${mealTitle}`}
        >
          <Plus
            size={18}
            color={isFutureDate ? theme.colors.textSecondary : theme.colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Entries List or Empty Placeholder */}
      {entries.length === 0 ? (
        <TouchableOpacity
          style={styles.emptyRow}
          onPress={() => !isFutureDate && onAddFood(mealType)}
          disabled={isFutureDate}
          activeOpacity={0.7}
        >
          <Text style={styles.emptyText}>
            {isFutureDate ? 'Nothing logged' : 'Nothing logged — tap to add'}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.entriesList}>
          {entries.map((entry) => (
            <FoodEntryRow
              key={entry.id}
              entry={entry}
              onEdit={onEditEntry}
              onDelete={onDeleteEntry}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
    backgroundColor: theme.colors.surfaceHighlight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  headerTitles: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
  },
  mealTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
  },
  caloriesBadge: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
  },
  macroSummary: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    marginTop: 2,
  },
  addButton: {
    padding: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginLeft: theme.spacing.sm,
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  entriesList: {},
  emptyRow: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    fontStyle: 'italic',
  },
});

