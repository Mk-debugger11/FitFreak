import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { BASIS_UNITS } from '../../constants/nutrition';
import { theme } from '../../theme';
import { LoggedFood } from '../../types';
import { formatCalories, formatGrams } from '../../utils/format';

interface FoodEntryRowProps {
  entry: LoggedFood;
  onEdit: (entry: LoggedFood) => void;
  onDelete: (id: string) => void;
}

export const FoodEntryRow: React.FC<FoodEntryRowProps> = ({
  entry,
  onEdit,
  onDelete,
}) => {
  const servingText =
    entry.servingLabel ||
    `${Math.round(entry.quantity)}${BASIS_UNITS[entry.basis]?.unit ?? 'g'}`;

  const macroSubtitle = `P ${formatGrams(entry.macros.protein)} • C ${formatGrams(
    entry.macros.carbs,
  )} • F ${formatGrams(entry.macros.fat)}`;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.detailsArea}
        onPress={() => onEdit(entry)}
        activeOpacity={0.7}
      >
        <View style={styles.infoCol}>
          <View style={styles.nameRow}>
            <Text style={styles.foodName} numberOfLines={1}>
              {entry.foodName}
            </Text>
            <Text style={styles.servingBadge} numberOfLines={1}>
              ({servingText})
            </Text>
          </View>
          <Text style={styles.macroSubtitle}>{macroSubtitle}</Text>
        </View>

        <Text style={styles.caloriesText}>
          {formatCalories(entry.macros.calories)} kcal
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(entry.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Trash2 size={16} color={theme.colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  detailsArea: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  infoCol: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'wrap',
  },
  foodName: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
  },
  servingBadge: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
  },
  macroSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    marginTop: 2,
  },
  caloriesText: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
  },
  deleteButton: {
    padding: theme.spacing.xs,
  },
});
