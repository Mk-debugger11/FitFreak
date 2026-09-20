import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { HorizontalCalendar } from '../../components';
import { useActiveWorkoutStore } from '../../store/activeWorkoutStore';
import { useHistoryStore } from '../../store/historyStore';
import { theme } from '../../theme';
import { EquipmentType } from '../../types';
import { isSameDay, isToday as isDateToday, toFetchKey, toLocalDateKey } from '../../utils/date';
import { listExercisesForCategory } from '../../utils/exercise';
import { CategoryPickerModal } from './CategoryPickerModal';
import { CustomExerciseModal } from './CustomExerciseModal';
import { ExercisePickerModal } from './ExercisePickerModal';
import { MuscleFilterModal } from './MuscleFilterModal';
import { TargetMuscleBar } from './TargetMuscleBar';
import { WorkoutCard } from './WorkoutCard';
import { shareWorkoutsForDate } from './exportWorkouts';

/** Which dialog, if any, is open. Starting a workout walks category → exercise. */
type OpenModal = 'none' | 'category' | 'exercise' | 'custom' | 'filter';

/**
 * The home screen: one day at a time, showing its target muscles and the
 * workouts logged against them.
 */
export const WorkoutLogScreen: React.FC = () => {
  const startWorkout = useActiveWorkoutStore((state) => state.startWorkout);
  const {
    completedWorkouts,
    deleteCompletedWorkout,
    targetMuscleGroups,
    addTargetMuscleGroup,
    removeTargetMuscleGroup,
    customExercises,
    addCustomExercise,
    fetchWorkoutsForDate,
    fetchedDates,
  } = useHistoryStore();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState<OpenModal>('none');
  const [isLoadingDate, setIsLoadingDate] = useState(false);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);

  const dateKey = toLocalDateKey(selectedDate);
  const selectedMuscles = targetMuscleGroups[dateKey] ?? [];
  const isToday = isDateToday(selectedDate);

  // A filter only makes sense for the day it was chosen on.
  useEffect(() => {
    setFilterCategory(null);
  }, [selectedDate]);

  // Days outside the initial window are fetched the first time they're opened.
  useEffect(() => {
    if (fetchedDates[toFetchKey(selectedDate)]) return;

    let cancelled = false;
    setIsLoadingDate(true);
    fetchWorkoutsForDate(selectedDate).finally(() => {
      if (!cancelled) setIsLoadingDate(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, fetchedDates, fetchWorkoutsForDate]);

  const workoutsForDate = useMemo(() => {
    const workouts = completedWorkouts.filter((workout) => {
      if (!isSameDay(workout.startTime, selectedDate)) return false;
      return filterCategory ? workout.category === filterCategory : true;
    });

    // Newest first while the day is still in progress, chronological once done.
    return workouts.sort((a, b) =>
      isToday
        ? b.startTime.getTime() - a.startTime.getTime()
        : a.startTime.getTime() - b.startTime.getTime(),
    );
  }, [completedWorkouts, selectedDate, filterCategory, isToday]);

  const categoryExercises = useMemo(
    () => listExercisesForCategory(selectedCategory, customExercises),
    [selectedCategory, customExercises],
  );

  const beginWorkout = (name: string, category?: string, equipmentType?: EquipmentType) => {
    startWorkout(name, { startTime: selectedDate, category, equipmentType });
    setOpenModal('none');
  };

  const handleCreateCustomExercise = (name: string, equipmentType: EquipmentType) => {
    if (!selectedCategory) return;
    addCustomExercise(selectedCategory, name, equipmentType);
    beginWorkout(name, selectedCategory, equipmentType);
  };

  return (
    <View style={styles.container}>
      <HorizontalCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      <TargetMuscleBar
        selectedMuscles={selectedMuscles}
        isToday={isToday}
        isFilterActive={filterCategory !== null}
        onAddMuscle={(muscleGroup) => addTargetMuscleGroup(dateKey, muscleGroup)}
        onRemoveMuscle={(muscleGroup) => removeTargetMuscleGroup(dateKey, muscleGroup)}
        onExtract={() => shareWorkoutsForDate(completedWorkouts, selectedDate)}
        onOpenFilter={() => setOpenModal('filter')}
        onNewWorkout={() => setOpenModal('category')}
        onDropdownVisibleChange={setIsDropdownVisible}
      />

      {isLoadingDate ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : workoutsForDate.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No workouts on this date.</Text>
        </View>
      ) : (
        <FlatList
          data={workoutsForDate}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          scrollEnabled={!isDropdownVisible}
          renderItem={({ item }) => (
            <WorkoutCard
              workout={item}
              onDelete={isToday ? () => deleteCompletedWorkout(item.id) : undefined}
            />
          )}
        />
      )}

      <CategoryPickerModal
        visible={openModal === 'category'}
        categories={selectedMuscles}
        onSelect={(category) => {
          setSelectedCategory(category);
          setOpenModal('exercise');
        }}
        onSelectMixed={() => beginWorkout('', 'Mixed')}
        onCancel={() => setOpenModal('none')}
      />

      <ExercisePickerModal
        visible={openModal === 'exercise'}
        category={selectedCategory}
        exercises={categoryExercises}
        onSelect={(exercise) =>
          beginWorkout(exercise.name, selectedCategory ?? undefined, exercise.equipmentType)
        }
        onCreateCustom={() => setOpenModal('custom')}
        onBack={() => setOpenModal('category')}
      />

      <CustomExerciseModal
        visible={openModal === 'custom'}
        onStart={handleCreateCustomExercise}
        onCancel={() => setOpenModal('none')}
      />

      <MuscleFilterModal
        visible={openModal === 'filter'}
        muscleGroups={selectedMuscles}
        selected={filterCategory}
        onSelect={(muscleGroup) => {
          setFilterCategory(muscleGroup);
          setOpenModal('none');
        }}
        onClose={() => setOpenModal('none')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  list: {
    padding: theme.spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.md,
  },
});
