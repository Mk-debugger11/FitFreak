import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User } from 'lucide-react-native';
import { HorizontalCalendar } from '../../components';
import { BASIS_UNITS } from '../../constants/nutrition';
import { theme } from '../../theme';
import { CustomFood, FoodItem, LoggedFood, MEAL_TYPES, MealType } from '../../types';
import { addDays, endOfDay, isSameDay, isToday, startOfDay, toLocalDateKey } from '../../utils/date';
import { useNutritionStore } from '../../store/nutritionStore';
import { CalorieSummaryCard } from './CalorieSummaryCard';
import { CustomFoodModal } from './CustomFoodModal';
import { FoodPickerModal } from './FoodPickerModal';
import { MacroTotalsBar } from './MacroTotalsBar';
import { MealSection } from './MealSection';
import { ProfileSheet } from './ProfileSheet';
import { ServingModal } from './ServingModal';
import { scaleMacros } from './servingMath';
import { useDayNutrition } from './useDayNutrition';

export const NutritionScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeMealType, setActiveMealType] = useState<MealType | null>(null);
  const [selectedFood, setSelectedFood] = useState<FoodItem | CustomFood | null>(null);
  const [editingEntry, setEditingEntry] = useState<LoggedFood | null>(null);

  // Modals visibility
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isServingOpen, setIsServingOpen] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  const [isLoadingDate, setIsLoadingDate] = useState(false);

  const dateKey = toLocalDateKey(selectedDate);
  const isFuture = selectedDate.getTime() > endOfDay(new Date()).getTime();

  const { byMeal, totals, entryCount } = useDayNutrition(dateKey);

  const fetchedNutritionDates = useNutritionStore(
    (state) => state.fetchedNutritionDates,
  );
  const fetchEntriesForDate = useNutritionStore(
    (state) => state.fetchEntriesForDate,
  );
  const isFetching = useNutritionStore((state) => state.isFetching);
  const foodsCatalog = useNutritionStore((state) => state.foodsCatalog);
  const customFoods = useNutritionStore((state) => state.customFoods);
  const logFood = useNutritionStore((state) => state.logFood);
  const updateLoggedFood = useNutritionStore((state) => state.updateLoggedFood);
  const deleteLoggedFood = useNutritionStore((state) => state.deleteLoggedFood);

  const isViewingTodayRef = useRef(true);

  const handleSelectDate = (date: Date) => {
    isViewingTodayRef.current = isToday(date);
    setSelectedDate(date);
  };

  // Focus effect to keep "today" aligned across midnight
  useFocusEffect(
    useCallback(() => {
      if (isViewingTodayRef.current) {
        const now = new Date();
        setSelectedDate((prev) => (isSameDay(prev, now) ? prev : now));
      }
    }, []),
  );

  // Date fetch on date change
  useEffect(() => {
    if (fetchedNutritionDates[dateKey]) {
      setIsLoadingDate(false);
      return;
    }

    const windowStart = startOfDay(addDays(new Date(), -7));
    const inInitial = startOfDay(selectedDate).getTime() >= windowStart.getTime();

    if (isFetching && inInitial) {
      setIsLoadingDate(true);
      return;
    }

    let cancelled = false;
    setIsLoadingDate(true);
    fetchEntriesForDate(dateKey).finally(() => {
      if (!cancelled) setIsLoadingDate(false);
    });

    return () => {
      cancelled = true;
    };
  }, [dateKey, selectedDate, fetchedNutritionDates, isFetching, fetchEntriesForDate]);

  // Modal handlers
  const handleOpenAddFood = (meal: MealType) => {
    setActiveMealType(meal);
    setSelectedFood(null);
    setEditingEntry(null);
    setIsPickerOpen(true);
  };

  const handleSelectFoodFromPicker = (food: FoodItem | CustomFood) => {
    setIsPickerOpen(false);
    setSelectedFood(food);
    setEditingEntry(null);
    setIsServingOpen(true);
  };

  const handleCreateCustomFromPicker = () => {
    setIsPickerOpen(false);
    setIsCustomOpen(true);
  };

  const handleCustomFoodCreated = (newFood: CustomFood) => {
    setIsCustomOpen(false);
    setSelectedFood(newFood);
    setEditingEntry(null);
    setIsServingOpen(true);
  };

  const handleEditEntry = (entry: LoggedFood) => {
    // Find food definition in custom foods or catalog
    let matchedFood: FoodItem | CustomFood | undefined;
    if (entry.foodId) {
      matchedFood = customFoods.find((f) => f.id === entry.foodId);
    }
    if (!matchedFood) {
      matchedFood = customFoods.find(
        (f) => f.name.toLowerCase() === entry.foodName.toLowerCase(),
      );
    }
    if (!matchedFood) {
      matchedFood = foodsCatalog.find(
        (f) => f.name.toLowerCase() === entry.foodName.toLowerCase(),
      );
    }

    if (!matchedFood) {
      // Synthesize food item at basis amount from snapshot
      const basisAmount = BASIS_UNITS[entry.basis]?.amount ?? 100;
      const scale = entry.quantity > 0 ? basisAmount / entry.quantity : 1;
      matchedFood = {
        name: entry.foodName,
        category: 'Other',
        basis: entry.basis,
        macros: {
          calories: entry.macros.calories * scale,
          protein: entry.macros.protein * scale,
          carbs: entry.macros.carbs * scale,
          fat: entry.macros.fat * scale,
        },
      };
    }

    setSelectedFood(matchedFood);
    setEditingEntry(entry);
    setActiveMealType(entry.mealType);
    setIsServingOpen(true);
  };

  const handleSaveServing = (quantity: number, servingLabel?: string) => {
    if (editingEntry) {
      if (selectedFood) {
        const macros = scaleMacros(selectedFood, quantity);
        updateLoggedFood(editingEntry.id, {
          quantity,
          servingLabel,
          macros,
        });
      } else {
        updateLoggedFood(editingEntry.id, {
          quantity,
          servingLabel,
        });
      }
    } else if (selectedFood && activeMealType) {
      logFood({
        dateString: dateKey,
        mealType: activeMealType,
        food: selectedFood,
        quantity,
        servingLabel,
        foodId: 'id' in selectedFood ? selectedFood.id : undefined,
      });
    }

    setIsServingOpen(false);
    setSelectedFood(null);
    setEditingEntry(null);
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        <Text style={styles.headerTitle}>Nutrition</Text>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => setIsProfileOpen(true)}
          accessibilityLabel="Open user profile settings"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <User size={22} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Date Bar */}
      <HorizontalCalendar
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
      />

      {/* Main Content List */}
      <FlatList
        data={MEAL_TYPES}
        keyExtractor={(meal) => meal}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <CalorieSummaryCard
              totals={totals}
              entryCount={entryCount}
              onOpenProfile={() => setIsProfileOpen(true)}
            />
            <MacroTotalsBar totals={totals} />
            {isLoadingDate && entryCount === 0 && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            )}
          </>
        }
        renderItem={({ item: mealType }) => (
          <MealSection
            mealType={mealType}
            entries={byMeal[mealType]?.entries ?? []}
            totals={byMeal[mealType]?.totals}
            isFutureDate={isFuture}
            onAddFood={handleOpenAddFood}
            onEditEntry={handleEditEntry}
            onDeleteEntry={deleteLoggedFood}
          />
        )}
      />

      {/* Dialog Modals */}
      <ProfileSheet
        visible={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <FoodPickerModal
        visible={isPickerOpen}
        mealType={activeMealType}
        onSelectFood={handleSelectFoodFromPicker}
        onCreateCustom={handleCreateCustomFromPicker}
        onClose={() => setIsPickerOpen(false)}
      />

      <ServingModal
        visible={isServingOpen}
        food={selectedFood}
        editingEntry={editingEntry}
        mealType={activeMealType}
        onSave={handleSaveServing}
        onClose={() => {
          setIsServingOpen(false);
          setSelectedFood(null);
          setEditingEntry(null);
        }}
      />

      <CustomFoodModal
        visible={isCustomOpen}
        onCreated={handleCustomFoodCreated}
        onClose={() => setIsCustomOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  profileButton: {
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceHighlight,
  },
  listContent: {
    paddingBottom: theme.spacing.xxl,
  },
  loadingContainer: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

