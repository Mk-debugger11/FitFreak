import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Chip, Input, ModalEmptyText, ModalOption, ModalSheet } from '../../components';
import { theme } from '../../theme';
import { CustomFood, FoodItem, MEAL_LABELS, MealType } from '../../types';
import { useNutritionStore } from '../../store/nutritionStore';

interface FoodPickerModalProps {
  visible: boolean;
  mealType: MealType | null;
  onSelectFood: (food: FoodItem | CustomFood) => void;
  onCreateCustom: () => void;
  onClose: () => void;
}

export const FoodPickerModal: React.FC<FoodPickerModalProps> = ({
  visible,
  mealType,
  onSelectFood,
  onCreateCustom,
  onClose,
}) => {
  const [query, setQuery] = useState('');

  const searchFoods = useNutritionStore((state) => state.searchFoods);
  const recentFoodsFn = useNutritionStore((state) => state.recentFoods);

  // Clear query on open/close
  useEffect(() => {
    if (!visible) {
      setQuery('');
    }
  }, [visible]);

  const recentList = useMemo(() => {
    if (!visible || query.trim().length > 0) return [];
    return recentFoodsFn(8);
  }, [visible, query, recentFoodsFn]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return searchFoods(query);
  }, [query, searchFoods]);

  const title = mealType ? `Add to ${MEAL_LABELS[mealType]}` : 'Select Food';

  return (
    <ModalSheet
      visible={visible}
      title={title}
      scrollable
      footer={
        <Button
          title="Cancel"
          variant="outline"
          onPress={onClose}
          style={{ marginTop: 8 }}
        />
      }
    >
      <Input
        placeholder="Search foods (e.g. roti, paneer, oats)"
        value={query}
        onChangeText={setQuery}
        autoFocus
      />

      {query.trim().length === 0 ? (
        <>
          {recentList.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Recent Foods</Text>
              {recentList.map((food, index) => {
                const isCustom = 'id' in food;
                const key = isCustom ? food.id : `${food.name}-${index}`;
                const subtitle = `${Math.round(food.macros.calories)} kcal • P ${Math.round(
                  food.macros.protein,
                )}g C ${Math.round(food.macros.carbs)}g F ${Math.round(food.macros.fat)}g`;

                return (
                  <ModalOption
                    key={key}
                    label={food.name}
                    subtitle={subtitle}
                    onPress={() => onSelectFood(food)}
                    trailing={
                      <Chip
                        label={isCustom ? 'Custom' : food.category}
                        style={styles.categoryChip}
                      />
                    }
                  />
                );
              })}
            </View>
          ) : (
            <ModalEmptyText>Type above to search catalogue foods</ModalEmptyText>
          )}
        </>
      ) : (
        <>
          {searchResults.length > 0 ? (
            searchResults.map((food, index) => {
              const isCustom = 'id' in food;
              const key = isCustom ? food.id : `${food.name}-${index}`;
              const subtitle = `${Math.round(food.macros.calories)} kcal • P ${Math.round(
                food.macros.protein,
              )}g C ${Math.round(food.macros.carbs)}g F ${Math.round(food.macros.fat)}g`;

              return (
                <ModalOption
                  key={key}
                  label={food.name}
                  subtitle={subtitle}
                  onPress={() => onSelectFood(food)}
                  trailing={
                    <Chip
                      label={isCustom ? 'Custom' : food.category}
                      style={styles.categoryChip}
                    />
                  }
                />
              );
            })
          ) : (
            <ModalEmptyText>No foods found matching "{query.trim()}"</ModalEmptyText>
          )}
        </>
      )}

      <ModalOption
        label="+ Create custom food"
        onPress={onCreateCustom}
        highlighted
      />
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: theme.spacing.sm,
  },
  sectionHeader: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 4,
  },
  categoryChip: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
