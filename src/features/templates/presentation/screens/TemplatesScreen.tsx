import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { theme } from '../../../../core/theme/theme';
import { useActiveWorkoutStore } from '../../../workouts/presentation/state/useActiveWorkoutStore';
import { useHistoryStore } from '../../../history/presentation/state/useHistoryStore';
import { Card } from '../../../../shared/components/Card';
import { Button } from '../../../../shared/components/Button';
import { Calendar as CalendarIcon, CheckSquare, Dumbbell, Trash2, X, Filter } from 'lucide-react-native';
import { HorizontalCalendar } from '../../../../shared/components/HorizontalCalendar';

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Forearm', 'Abs', 'Core', 'Neck', 'Cardio', 'Full Body'
];

const MUSCLE_EXERCISES: Record<string, string[]> = {
  'Chest': ['Incline Dumbbell Press', 'Flat Dumbbell Press', 'Barbell Bench Press', 'Pec Deck Fly', 'Cable Fly'],
  'Back': ['Lat Pulldown', 'Pull-ups', 'Seated Cable Row', 'One-arm Dumbbell Row', 'T-Bar Row', 'Deadlift'],
  'Shoulders': ['Dumbbell Shoulder Press', 'Lateral Raise', 'Rear Delt Fly', 'Upright Row', 'Shrugs', "Farmer's Walk"],
  'Biceps': ['Dumbbell Curl', 'Incline Dumbbell Curl', 'Preacher Curl', 'Barbell Curl', 'Hammer Curl'],
  'Triceps': ['Tricep Pushdown', 'Overhead Cable Extension', 'Overhead Dumbbell Extension', 'Dips', 'Close-Grip Bench Press'],
  'Forearm': ['Wrist Curl', 'Reverse Wrist Curl', 'Reverse Cable Curl', "Farmer's Walk"],
  'Legs': ['Squat', 'Leg Press', 'Romanian Deadlift', 'Leg Curl', 'Leg Extension', 'Bulgarian Split Squat', 'Lunges', 'Calf Raise'],
  'Abs': ['Cable Crunch', 'Hanging Leg Raise', 'Reverse Crunch', 'Plank', 'Russian Twist'],
  'Core': ['Cable Crunch', 'Hanging Leg Raise', 'Reverse Crunch', 'Plank', 'Russian Twist'],
  'Neck': ['Neck Flexion', 'Neck Extension', 'Neck Harness Work']
};

export const TemplatesScreen = () => {
  const { startWorkout } = useActiveWorkoutStore();
  const { completedWorkouts, updateCompletedWorkoutName, deleteCompletedWorkout, targetMuscleGroups, addTargetMuscleGroup, removeTargetMuscleGroup, customExercises, addCustomExercise } = useHistoryStore();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingMuscle, setIsAddingMuscle] = useState(false);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isExerciseModalVisible, setIsExerciseModalVisible] = useState(false);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  // Clear filter when date changes
  React.useEffect(() => {
    setFilterCategory(null);
  }, [selectedDate]);

  const workoutsForDate = completedWorkouts.filter((w) => {
    const isSameDate = 
      w.startTime.getDate() === selectedDate.getDate() &&
      w.startTime.getMonth() === selectedDate.getMonth() &&
      w.startTime.getFullYear() === selectedDate.getFullYear();
      
    if (!isSameDate) return false;
    if (filterCategory) return w.category === filterCategory;
    return true;
  });

  const isToday =
    selectedDate.getDate() === new Date().getDate() &&
    selectedDate.getMonth() === new Date().getMonth() &&
    selectedDate.getFullYear() === new Date().getFullYear();

  const dateKey = selectedDate.toISOString().split('T')[0];
  const selectedMuscles = targetMuscleGroups[dateKey] || [];

  const filteredMuscleGroups = MUSCLE_GROUPS.filter(mg =>
    mg.toLowerCase().includes(searchQuery.toLowerCase()) && !selectedMuscles.includes(mg)
  );

  const shouldShowSearch = selectedMuscles.length === 0 || isAddingMuscle;

  const currentCategoryExercises = selectedCategory 
    ? Array.from(new Set([...(MUSCLE_EXERCISES[selectedCategory] || []), ...(customExercises[selectedCategory] || [])]))
    : [];

  return (
    <View style={styles.container}>
      <HorizontalCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      
      <View style={{ zIndex: 10 }}>
        <View style={styles.header}>
          {shouldShowSearch && isToday ? (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: theme.spacing.sm }}>
              <TextInput
                style={styles.titleInput}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  setIsDropdownVisible(true);
                }}
                onFocus={() => setIsDropdownVisible(true)}
                onBlur={() => {
                  setTimeout(() => {
                    setIsDropdownVisible(false);
                    if (selectedMuscles.length > 0) setIsAddingMuscle(false);
                  }, 200);
                }}
                placeholder="Search Target Muscle"
                placeholderTextColor={theme.colors.textSecondary}
                autoFocus={isAddingMuscle}
              />
              {isDropdownVisible && (
                <TouchableOpacity 
                  onPress={() => {
                    setIsDropdownVisible(false);
                    setIsAddingMuscle(false);
                    setSearchQuery('');
                  }}
                  style={{ padding: 4, marginLeft: 4 }}
                >
                  <X size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          ) : !isToday && selectedMuscles.length === 0 ? (
            <Text style={[styles.titleInput, { color: theme.colors.textSecondary }]}>
              No target muscles set
            </Text>
          ) : (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: theme.spacing.sm }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                {selectedMuscles.map(mg => (
                  <View key={mg} style={styles.chip}>
                    <Text style={styles.chipText}>{mg}</Text>
                    {isToday && (
                      <TouchableOpacity onPress={() => removeTargetMuscleGroup(dateKey, mg)}>
                        <X size={14} color={theme.colors.text} style={styles.chipIcon} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>
              {isToday && (
                <TouchableOpacity 
                  style={styles.addChipButton} 
                  onPress={() => setIsAddingMuscle(true)}
                >
                  <Text style={styles.addChipButtonText}>+</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              disabled={selectedMuscles.length <= 1} 
              onPress={() => setIsFilterModalVisible(true)}
              style={{ marginRight: 12, opacity: selectedMuscles.length <= 1 ? 0.3 : 1 }}
            >
              <Filter color={filterCategory ? theme.colors.primary : theme.colors.text} size={20} />
            </TouchableOpacity>
            {isToday && (
              <Button 
                title="New"
                onPress={() => setIsCategoryModalVisible(true)}
                size="small"
                style={{ paddingHorizontal: 12, paddingVertical: 6 }}
                textStyle={{ fontSize: theme.typography.sizes.sm }}
              />
            )}
          </View>
        </View>

        {isDropdownVisible && isToday && filteredMuscleGroups.length > 0 && (
          <ScrollView style={styles.dropdownContainer} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
            {filteredMuscleGroups.map(mg => (
              <TouchableOpacity 
                key={mg} 
                style={styles.dropdownItem}
                onPress={() => {
                  addTargetMuscleGroup(dateKey, mg);
                  setSearchQuery('');
                  setIsDropdownVisible(false);
                  setIsAddingMuscle(false);
                }}
              >
                <Text style={styles.dropdownItemText}>{mg}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {workoutsForDate.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No workouts on this date.</Text>
        </View>
      ) : (
        <FlatList
          data={workoutsForDate}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          scrollEnabled={!isDropdownVisible}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  {item.category && (
                    <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: 'bold', marginBottom: 2 }}>{item.category.toUpperCase()}</Text>
                  )}
                  <Text style={styles.cardTitleText}>
                    {item.name || 'Unnamed Exercise'}
                  </Text>
                </View>
                <View style={styles.headerRight}>
                  <Text style={styles.dateText}>
                    {item.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {isToday && (
                    <TouchableOpacity style={styles.deleteButton} onPress={() => deleteCompletedWorkout(item.id)}>
                      <Trash2 color={theme.colors.error || "#FF4444"} size={20} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <CalendarIcon size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.statText}>
                    {Math.max(1, Math.floor((item.endTime.getTime() - item.startTime.getTime()) / 60000))} min
                  </Text>
                </View>
                <View style={styles.stat}>
                  <CheckSquare size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.statText}>{item.totalSets} sets</Text>
                </View>
              </View>

              {item.workoutData?.sets && item.workoutData.sets.length > 0 && (
                <View style={styles.setsContainer}>
                  {item.workoutData.sets.map((set, index) => (
                    <View key={set.id} style={styles.setRow}>
                      <Text style={styles.setIndexText}>Set {index + 1}</Text>
                      <Text style={styles.setDetailText}>{set.weight} kg × {set.reps} reps</Text>
                      {set.completed ? (
                        <CheckSquare size={14} color={theme.colors.success || '#4CAF50'} />
                      ) : (
                        <View style={styles.uncompletedDot} />
                      )}
                    </View>
                  ))}
                </View>
              )}
            </Card>
          )}
        />
      )}

      <Modal visible={isCategoryModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Workout Category</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {selectedMuscles.length > 0 ? (
                selectedMuscles.map(mg => (
                  <TouchableOpacity 
                    key={mg} 
                    style={styles.modalItem}
                    onPress={() => {
                      setIsCategoryModalVisible(false);
                      if (MUSCLE_EXERCISES[mg] && MUSCLE_EXERCISES[mg].length > 0) {
                        setSelectedCategory(mg);
                        setIsExerciseModalVisible(true);
                      } else {
                        startWorkout('', undefined, selectedDate, mg);
                      }
                    }}
                  >
                    <Text style={styles.modalItemText}>{mg}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={[styles.modalItemText, { paddingVertical: theme.spacing.md, color: theme.colors.textSecondary, textAlign: 'center' }]}>
                  Add target muscles first!
                </Text>
              )}
              <TouchableOpacity 
                  style={styles.modalItem}
                  onPress={() => {
                    startWorkout('', undefined, selectedDate, 'Mixed');
                    setIsCategoryModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemText}>Mixed / Other</Text>
                </TouchableOpacity>
            </ScrollView>
            <Button title="Cancel" variant="outline" onPress={() => setIsCategoryModalVisible(false)} style={{ marginTop: 16 }} />
          </View>
        </View>
      </Modal>

      <Modal visible={isExerciseModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Exercise for {selectedCategory}</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {currentCategoryExercises.map(ex => (
                <TouchableOpacity 
                  key={ex} 
                  style={styles.modalItem}
                  onPress={() => {
                    startWorkout(ex, undefined, selectedDate, selectedCategory);
                    setIsExerciseModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{ex}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity 
                style={styles.modalItem}
                onPress={() => {
                  startWorkout('', undefined, selectedDate, selectedCategory || undefined);
                  setIsExerciseModalVisible(false);
                }}
              >
                <Text style={[styles.modalItemText, { color: theme.colors.primary, fontWeight: 'bold' }]}>Custom Exercise</Text>
              </TouchableOpacity>
            </ScrollView>
            <Button title="Back" variant="outline" onPress={() => {
              setIsExerciseModalVisible(false);
              setIsCategoryModalVisible(true);
            }} style={{ marginTop: 16 }} />
          </View>
        </View>
      </Modal>

      <Modal visible={isFilterModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter by Muscle Group</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity 
                style={styles.modalItem}
                onPress={() => {
                  setFilterCategory(null);
                  setIsFilterModalVisible(false);
                }}
              >
                <Text style={[styles.modalItemText, filterCategory === null && { color: theme.colors.primary, fontWeight: 'bold' }]}>
                  All Muscles
                </Text>
              </TouchableOpacity>
              {selectedMuscles.map(mg => (
                <TouchableOpacity 
                  key={mg} 
                  style={styles.modalItem}
                  onPress={() => {
                    setFilterCategory(mg);
                    setIsFilterModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalItemText, filterCategory === mg && { color: theme.colors.primary, fontWeight: 'bold' }]}>
                    {mg}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button title="Close" variant="outline" onPress={() => setIsFilterModalVisible(false)} style={{ marginTop: 16 }} />
          </View>
        </View>
      </Modal>
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
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceHighlight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    height: 32,
  },
  addChipButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceHighlight,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginLeft: theme.spacing.sm,
  },
  addChipButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.md,
    fontWeight: 'bold',
  },
  chipText: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
  },
  chipIcon: {
    marginLeft: 6,
  },
  titleInput: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold as any,
    flex: 1,
    marginRight: theme.spacing.sm,
    padding: 0,
  },
  dropdownContainer: {
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: 350,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  dropdownItem: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dropdownItemText: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.md,
  },
  list: {
    padding: theme.spacing.md,
  },
  card: {
    marginBottom: theme.spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  cardTitleText: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold as any,
    flex: 1,
    padding: 0,
    marginRight: theme.spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    marginLeft: 12,
    padding: 4,
  },
  dateText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    marginLeft: 4,
  },
  setsContainer: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  setIndexText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    width: 60,
  },
  setDetailText: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    flex: 1,
  },
  uncompletedDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: theme.colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  modalContent: {
    backgroundColor: theme.colors.surfaceHighlight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.lg,
    fontWeight: 'bold',
    marginBottom: theme.spacing.md,
  },
  modalItem: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalItemText: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.md,
  },
});

