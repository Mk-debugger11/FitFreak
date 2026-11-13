import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { HorizontalCalendar } from '../../components';
import { useActiveWorkoutStore } from '../../store/activeWorkoutStore';
import { isDateInInitialWindow, useHistoryStore } from '../../store/historyStore';
import { theme } from '../../theme';
import { EquipmentType } from '../../types';
import { isSameDay, isToday as isDateToday, toFetchKey, toLocalDateKey } from '../../utils/date';
import { ExplicitMuscleTargets, listExercisesForCategory } from '../../utils/exercise';
import { formatWorkoutTitle } from '../active-workout/workoutSessionUtils';
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
 * The workout log screen: one day at a time, showing its target muscles and the
 * workouts logged against them.
 */
export const WorkoutLogScreen: React.FC = () => {
  const currentWorkout = useActiveWorkoutStore((state) => state.currentWorkout);
  const startWorkout = useActiveWorkoutStore((state) => state.startWorkout);
  const resumeWorkout = useActiveWorkoutStore((state) => state.resumeWorkout);
  const {
    completedWorkouts,
    deleteCompletedWorkout,
    targetMuscleGroups,
    addTargetMuscleGroup,
    removeTargetMuscleGroup,
    customExercises,
    exercisesCatalog,
    addCustomExercise,
    fetchWorkoutsForDate,
    fetchedDates,
    isFetching,
  } = useHistoryStore();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState<OpenModal>('none');
  const [isLoadingDate, setIsLoadingDate] = useState(false);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);

  const dateKey = toLocalDateKey(selectedDate);
  const isToday = isDateToday(selectedDate);

  // A filter only makes sense for the day it was chosen on.
  useEffect(() => {
    setFilterCategory(null);
  }, [selectedDate]);

  // Days outside the initial window are fetched the first time they're opened.
  useEffect(() => {
    const fetchKey = toFetchKey(selectedDate);
    if (fetchedDates[fetchKey]) {
      setIsLoadingDate(false);
      return;
    }

    if (isFetching && isDateInInitialWindow(selectedDate)) {
      // Initial fetchData() already covers this date window; avoid a duplicate request.
      setIsLoadingDate(true);
      return;
    }

    let cancelled = false;
    setIsLoadingDate(true);
    fetchWorkoutsForDate(selectedDate).finally(() => {
      if (!cancelled) setIsLoadingDate(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, fetchedDates, isFetching, fetchWorkoutsForDate]);

  const dayWorkouts = useMemo(() => {
    const workouts = completedWorkouts.filter((workout) => isSameDay(workout.startTime, selectedDate));

    // Newest first while the day is still in progress, chronological once done.
    return workouts.sort((a, b) =>
      isToday
        ? b.startTime.getTime() - a.startTime.getTime()
        : a.startTime.getTime() - b.startTime.getTime(),
    );
  }, [completedWorkouts, selectedDate, isToday]);

  const workoutsForDate = useMemo(
    () => (filterCategory ? dayWorkouts.filter((workout) => workout.category === filterCategory) : dayWorkouts),
    [dayWorkouts, filterCategory],
  );

  const selectedMuscles = useMemo(() => {
    const explicit = targetMuscleGroups[dateKey] ?? [];
    if (isToday) return explicit;

    // On past days, surface muscle categories from logged workouts if target-muscles wasn't saved.
    const seen = new Set(explicit);
    const derived = [...explicit];
    for (const workout of dayWorkouts) {
      if (workout.category && workout.category !== 'Mixed' && !seen.has(workout.category)) {
        seen.add(workout.category);
        derived.push(workout.category);
      }
    }
    return derived;
  }, [targetMuscleGroups, dateKey, isToday, dayWorkouts]);

  const categoryExercises = useMemo(
    () => listExercisesForCategory(selectedCategory, customExercises, exercisesCatalog),
    [selectedCategory, customExercises, exercisesCatalog],
  );

  const beginWorkout = (
    name: string,
    category?: string,
    equipmentType?: EquipmentType,
    explicitTargets?: ExplicitMuscleTargets,
  ) => {
    startWorkout(name, {
      startTime: isToday ? new Date() : selectedDate,
      category,
      equipmentType,
      primaryMuscles: explicitTargets?.primaryMuscles,
      secondaryMuscles: explicitTargets?.secondaryMuscles,
      stabilizerMuscles: explicitTargets?.stabilizerMuscles,
    });
    setOpenModal('none');
  };

  const handleCreateCustomExercise = (name: string, equipmentType: EquipmentType) => {
    if (!selectedCategory) return;
    addCustomExercise(selectedCategory, name, equipmentType);
    beginWorkout(name, selectedCategory, equipmentType);
  };

  const handleNewWorkout = () => {
    if (currentWorkout === null) {
      setOpenModal('category');
      return;
    }

    Alert.alert(
      'Workout in progress',
      `${formatWorkoutTitle(currentWorkout.name, currentWorkout.category)} is minimized. Resume it or replace it with a new workout?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () => setOpenModal('category'),
        },
        { text: 'Resume', onPress: resumeWorkout },
      ],
    );
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
        onNewWorkout={handleNewWorkout}
        onDropdownVisibleChange={setIsDropdownVisible}
      />

      {isLoadingDate && workoutsForDate.length === 0 ? (
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
          beginWorkout(exercise.name, selectedCategory ?? undefined, exercise.equipmentType, {
            primaryMuscles: exercise.primaryMuscles,
            secondaryMuscles: exercise.secondaryMuscles,
            stabilizerMuscles: exercise.stabilizerMuscles,
          })
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
