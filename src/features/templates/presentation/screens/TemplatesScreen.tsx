import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ScrollView, Modal, Share, Alert } from 'react-native';
import { theme } from '../../../../core/theme/theme';
import { useActiveWorkoutStore } from '../../../workouts/presentation/state/useActiveWorkoutStore';
import { useHistoryStore } from '../../../history/presentation/state/useHistoryStore';
import { Card } from '../../../../shared/components/Card';
import { Button } from '../../../../shared/components/Button';
import { Calendar as CalendarIcon, CheckSquare, Dumbbell, Trash2, X, Filter, Download } from 'lucide-react-native';
import { HorizontalCalendar } from '../../../../shared/components/HorizontalCalendar';

import { DEFAULT_MUSCLE_EXERCISES } from '../../data/metadata/exercises';
import { formatSetDisplay, getLocalISODate } from '../../../../shared/utils/formatters';
import { EquipmentType } from '../../../../shared/types/common';

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Forearm', 'Abs', 'Core', 'Neck', 'Cardio', 'Full Body'
];

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
  const [isCustomModalVisible, setIsCustomModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [customExName, setCustomExName] = useState('');
  const [customExEquipment, setCustomExEquipment] = useState<EquipmentType>('barbell');

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

  const dateKey = getLocalISODate(selectedDate);
  const selectedMuscles = targetMuscleGroups[dateKey] || [];

  const filteredMuscleGroups = MUSCLE_GROUPS.filter(mg =>
    mg.toLowerCase().includes(searchQuery.toLowerCase()) && !selectedMuscles.includes(mg)
  );

  const shouldShowSearch = selectedMuscles.length === 0 || isAddingMuscle;

  const currentCategoryExercises = selectedCategory 
    ? [...(DEFAULT_MUSCLE_EXERCISES[selectedCategory] || []), ...(customExercises[selectedCategory] || [])]
    : [];

  const handleExtract = async () => {
    const dateKey = getLocalISODate(selectedDate);
    const data: any = { [dateKey]: {} };

    // Get all workouts for the selected date (ignoring category filter)
    const allWorkoutsForDate = completedWorkouts.filter((w) => {
      return w.startTime.getDate() === selectedDate.getDate() &&
             w.startTime.getMonth() === selectedDate.getMonth() &&
             w.startTime.getFullYear() === selectedDate.getFullYear();
    });

    if (allWorkoutsForDate.length === 0) {
      Alert.alert('No Workouts', 'There are no workouts to extract for this date.');
      return;
    }

    allWorkoutsForDate.forEach(w => {
      const cat = w.category || 'Uncategorized';
      if (!data[dateKey][cat]) {
        data[dateKey][cat] = {};
      }
      
      const exName = w.name || 'Unnamed Exercise';
      
      if (!data[dateKey][cat][exName]) {
        data[dateKey][cat][exName] = [];
      }

      let eqType = w.equipmentType;
      if (!eqType) {
        const allExercises = Object.values(DEFAULT_MUSCLE_EXERCISES).flat();
        const found = allExercises.find(e => e.name.toLowerCase() === w.name?.toLowerCase());
        eqType = found ? found.equipmentType : 'barbell';
      }

      if (w.workoutData && w.workoutData.sets) {
        const completedSets = w.workoutData.sets.filter(s => s.completed);
        completedSets.forEach(s => {
          data[dateKey][cat][exName].push(formatSetDisplay(s.weight, s.reps, eqType as EquipmentType));
        });
      } else {
        data[dateKey][cat][exName].push(`Total Sets: ${w.totalSets}`);
      }
    });

    const jsonString = JSON.stringify(data, null, 2);

    try {
      await Share.share({
        message: jsonString,
        title: `Workout Extract - ${dateKey}`
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

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
              onPress={handleExtract}
              style={{ marginRight: 12 }}
            >
              <Download color={theme.colors.text} size={20} />
            </TouchableOpacity>
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
                  {item.workoutData.sets.map((set, index) => {
                    // Infer equipmentType if missing (backward compatibility for old records)
                    let eqType = item.equipmentType;
                    if (!eqType) {
                      const allExercises = Object.values(DEFAULT_MUSCLE_EXERCISES).flat();
                      const found = allExercises.find(e => e.name.toLowerCase() === item.name.toLowerCase());
                      eqType = found ? found.equipmentType : 'barbell'; // default fallback
                    }

                    return (
                      <View key={set.id} style={styles.setRow}>
                        <Text style={styles.setIndexText}>Set {index + 1}</Text>
                        <Text style={styles.setDetailText}>{formatSetDisplay(set.weight, set.reps, eqType as EquipmentType)}</Text>
                        {set.completed ? (
                          <CheckSquare size={14} color={theme.colors.success || '#4CAF50'} />
                        ) : (
                          <View style={styles.uncompletedDot} />
                        )}
                      </View>
                    );
                  })}
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
                      setSelectedCategory(mg);
                      setIsExerciseModalVisible(true);
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
              {currentCategoryExercises.map((ex, idx) => (
                <TouchableOpacity 
                  key={`${ex.name}-${idx}`} 
                  style={styles.modalItem}
                  onPress={() => {
                    startWorkout(ex.name, undefined, selectedDate, selectedCategory || undefined, ex.equipmentType);
                    setIsExerciseModalVisible(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Text style={styles.modalItemText}>{ex.name}</Text>
                    {ex.equipmentType && (
                      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.sizes.sm, textTransform: 'capitalize' }}>
                        {ex.equipmentType}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity 
                style={styles.modalItem}
                onPress={() => {
                  setIsExerciseModalVisible(false);
                  setCustomExName('');
                  setCustomExEquipment('barbell');
                  setIsCustomModalVisible(true);
                }}
              >
                <Text style={[styles.modalItemText, { color: theme.colors.primary, fontWeight: 'bold' }]}>+ Create Custom Exercise</Text>
              </TouchableOpacity>
            </ScrollView>
            <Button title="Back" variant="outline" onPress={() => {
              setIsExerciseModalVisible(false);
              setIsCategoryModalVisible(true);
            }} style={{ marginTop: 16 }} />
          </View>
        </View>
      </Modal>

      <Modal visible={isCustomModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Custom Exercise</Text>
            <TextInput 
              style={[styles.searchInput, { marginBottom: 16 }]}
              placeholder="Exercise Name"
              value={customExName}
              onChangeText={setCustomExName}
              autoFocus
            />
            <Text style={{ marginBottom: 8, color: theme.colors.text }}>Equipment Type:</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {(['dumbbell', 'barbell', 'machine', 'cable', 'bodyweight'] as EquipmentType[]).map(type => (
                <TouchableOpacity 
                  key={type}
                  onPress={() => setCustomExEquipment(type)}
                  style={[
                    styles.chip,
                    customExEquipment === type && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                  ]}
                >
                  <Text style={[
                    { color: theme.colors.textSecondary, textTransform: 'capitalize' },
                    customExEquipment === type && { color: theme.colors.background }
                  ]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button title="Start Workout" onPress={() => {
              if (customExName.trim() && selectedCategory) {
                addCustomExercise(selectedCategory, customExName.trim(), customExEquipment);
                startWorkout(customExName.trim(), undefined, selectedDate, selectedCategory, customExEquipment);
                setIsCustomModalVisible(false);
              }
            }} />
            <Button title="Cancel" variant="outline" onPress={() => setIsCustomModalVisible(false)} style={{ marginTop: 8 }} />
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

