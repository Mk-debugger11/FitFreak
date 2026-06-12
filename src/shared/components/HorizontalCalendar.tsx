import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { theme } from '../../core/theme/theme';

interface HorizontalCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const generateDates = () => {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Past 365 days + today + next 1 day
  for (let i = -365; i <= 1; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
};

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const HorizontalCalendar: React.FC<HorizontalCalendarProps> = ({ selectedDate, onSelectDate }) => {
  const dates = useMemo(() => generateDates(), []);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Attempt to scroll to selected date on mount
    const index = dates.findIndex(
      (d) =>
        d.getDate() === selectedDate.getDate() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getFullYear() === selectedDate.getFullYear()
    );
    if (index >= 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      }, 100);
    }
  }, []);

  const renderItem = ({ item }: { item: Date }) => {
    const isSelected =
      item.getDate() === selectedDate.getDate() &&
      item.getMonth() === selectedDate.getMonth() &&
      item.getFullYear() === selectedDate.getFullYear();

    const isToday =
      item.getDate() === new Date().getDate() &&
      item.getMonth() === new Date().getMonth() &&
      item.getFullYear() === new Date().getFullYear();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const isFuture = item.getTime() > todayStart.getTime();

    return (
      <TouchableOpacity
        style={[styles.dateItem, isSelected && styles.selectedDateItem]}
        onPress={() => onSelectDate(item)}
        disabled={isFuture}
      >
        <Text style={[styles.dayText, isSelected && styles.selectedText, isFuture && styles.futureText]}>
          {daysOfWeek[item.getDay()]}
        </Text>
        <View style={[styles.dateCircle, isSelected && styles.selectedDateCircle]}>
          <Text style={[styles.dateText, isSelected && styles.selectedText, isFuture && styles.futureText]}>
            {item.getDate()}
          </Text>
        </View>
        <Text style={[styles.monthText, isSelected && styles.selectedText, isFuture && styles.futureText]}>
          {months[item.getMonth()]}
        </Text>
        {isToday && !isSelected && <View style={styles.todayDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={dates}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.toISOString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        getItemLayout={(_, index) => ({
          length: 64, // approximate width + margin
          offset: 64 * index,
          index,
        })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  list: {
    paddingHorizontal: theme.spacing.md,
  },
  dateItem: {
    width: 56,
    alignItems: 'center',
    marginRight: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  selectedDateItem: {
    backgroundColor: theme.colors.primary,
  },
  dayText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    marginBottom: 4,
  },
  dateCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  selectedDateCircle: {
    backgroundColor: theme.colors.primary,
  },
  dateText: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.md,
    fontWeight: 'bold',
  },
  monthText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
  },
  selectedText: {
    color: theme.colors.surface,
  },
  futureText: {
    color: theme.colors.border,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
    marginTop: 2,
  },
});
