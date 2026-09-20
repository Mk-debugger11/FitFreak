import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Download, Filter, X } from 'lucide-react-native';
import { Button, Chip } from '../../components';
import { MUSCLE_GROUPS } from '../../constants/exercises';
import { theme } from '../../theme';

/** Give the dropdown time to register a tap before hiding it on blur. */
const BLUR_DELAY_MS = 200;

interface TargetMuscleBarProps {
  selectedMuscles: string[];
  /** Target muscles can only be edited on the current day. */
  isToday: boolean;
  isFilterActive: boolean;
  onAddMuscle: (muscleGroup: string) => void;
  onRemoveMuscle: (muscleGroup: string) => void;
  onExtract: () => void;
  onOpenFilter: () => void;
  onNewWorkout: () => void;
  /** Lets the screen stop the list scrolling underneath the dropdown. */
  onDropdownVisibleChange: (visible: boolean) => void;
}

export const TargetMuscleBar: React.FC<TargetMuscleBarProps> = ({
  selectedMuscles,
  isToday,
  isFilterActive,
  onAddMuscle,
  onRemoveMuscle,
  onExtract,
  onOpenFilter,
  onNewWorkout,
  onDropdownVisibleChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [isAddingMuscle, setIsAddingMuscle] = useState(false);

  useEffect(() => {
    onDropdownVisibleChange(isDropdownVisible);
  }, [isDropdownVisible, onDropdownVisibleChange]);

  const suggestions = MUSCLE_GROUPS.filter(
    (muscleGroup) =>
      muscleGroup.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !selectedMuscles.includes(muscleGroup),
  );

  const closeSearch = () => {
    setIsDropdownVisible(false);
    setIsAddingMuscle(false);
    setSearchQuery('');
  };

  const handleSelect = (muscleGroup: string) => {
    onAddMuscle(muscleGroup);
    closeSearch();
  };

  const showSearch = isToday && (selectedMuscles.length === 0 || isAddingMuscle);
  const showEmptyLabel = !isToday && selectedMuscles.length === 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        {showSearch ? (
          <View style={styles.headerMain}>
            <TextInput
              style={styles.searchInput}
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
                }, BLUR_DELAY_MS);
              }}
              placeholder="Search Target Muscle"
              placeholderTextColor={theme.colors.textSecondary}
              autoFocus={isAddingMuscle}
            />
            {isDropdownVisible ? (
              <TouchableOpacity onPress={closeSearch} style={styles.clearButton}>
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : showEmptyLabel ? (
          <Text style={[styles.searchInput, styles.emptyLabel]}>No target muscles set</Text>
        ) : (
          <View style={styles.headerMain}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {selectedMuscles.map((muscleGroup) => (
                <Chip
                  key={muscleGroup}
                  label={muscleGroup}
                  onRemove={isToday ? () => onRemoveMuscle(muscleGroup) : undefined}
                />
              ))}
            </ScrollView>
            {isToday ? (
              <TouchableOpacity style={styles.addChipButton} onPress={() => setIsAddingMuscle(true)}>
                <Text style={styles.addChipButtonText}>+</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity onPress={onExtract} style={styles.actionButton}>
            <Download color={theme.colors.text} size={20} />
          </TouchableOpacity>
          <TouchableOpacity
            disabled={selectedMuscles.length <= 1}
            onPress={onOpenFilter}
            style={[styles.actionButton, selectedMuscles.length <= 1 && styles.actionDisabled]}
          >
            <Filter color={isFilterActive ? theme.colors.primary : theme.colors.text} size={20} />
          </TouchableOpacity>
          {isToday ? (
            <Button
              title="New"
              onPress={onNewWorkout}
              size="small"
              style={styles.newButton}
              textStyle={styles.newButtonText}
            />
          ) : null}
        </View>
      </View>

      {isDropdownVisible && isToday && suggestions.length > 0 ? (
        <ScrollView style={styles.dropdown} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          {suggestions.map((muscleGroup) => (
            <TouchableOpacity
              key={muscleGroup}
              style={styles.dropdownItem}
              onPress={() => handleSelect(muscleGroup)}
            >
              <Text style={styles.dropdownItemText}>{muscleGroup}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  searchInput: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    flex: 1,
    marginRight: theme.spacing.sm,
    padding: 0,
  },
  emptyLabel: {
    color: theme.colors.textSecondary,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  chipRow: {
    flex: 1,
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
    fontWeight: theme.typography.weights.bold,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginRight: 12,
  },
  actionDisabled: {
    opacity: 0.3,
  },
  newButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  newButtonText: {
    fontSize: theme.typography.sizes.sm,
  },
  dropdown: {
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
});
