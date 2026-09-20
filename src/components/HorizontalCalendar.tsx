import React, { useEffect, useMemo, useRef } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme';
import { addDays, isSameDay, isToday, startOfDay } from '../utils/date';

/** How far back the strip scrolls, and how far forward it shows. */
const DAYS_IN_PAST = 365;
const DAYS_IN_FUTURE = 1;
/** Item width + margin, needed so `scrollToIndex` can jump without measuring. */
const ITEM_SIZE = 64;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface HorizontalCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const buildDates = (): Date[] => {
  const today = startOfDay(new Date());
  const dates: Date[] = [];
  for (let offset = -DAYS_IN_PAST; offset <= DAYS_IN_FUTURE; offset += 1) {
    dates.push(addDays(today, offset));
  }
  return dates;
};

export const HorizontalCalendar: React.FC<HorizontalCalendarProps> = ({ selectedDate, onSelectDate }) => {
  const dates = useMemo(buildDates, []);
  const listRef = useRef<FlatList<Date>>(null);

  // Centre the strip on the selected date when the screen first opens.
  useEffect(() => {
    const index = dates.findIndex((date) => isSameDay(date, selectedDate));
    if (index < 0) return;

    const timeout = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    }, 100);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on mount only
  }, []);

  const renderItem = ({ item }: { item: Date }) => {
    const selected = isSameDay(item, selectedDate);
    const isFutureDate = item.getTime() > startOfDay(new Date()).getTime();

    return (
      <TouchableOpacity
        style={[styles.dateItem, selected && styles.selectedDateItem]}
        onPress={() => onSelectDate(item)}
        disabled={isFutureDate}
      >
        <Text style={[styles.dayText, selected && styles.selectedText, isFutureDate && styles.futureText]}>
          {DAY_LABELS[item.getDay()]}
        </Text>
        <View style={[styles.dateCircle, selected && styles.selectedDateCircle]}>
          <Text style={[styles.dateText, selected && styles.selectedText, isFutureDate && styles.futureText]}>
            {item.getDate()}
          </Text>
        </View>
        <Text style={[styles.monthText, selected && styles.selectedText, isFutureDate && styles.futureText]}>
          {MONTH_LABELS[item.getMonth()]}
        </Text>
        {isToday(item) && !selected ? <View style={styles.todayDot} /> : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={dates}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.toISOString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        getItemLayout={(_, index) => ({
          length: ITEM_SIZE,
          offset: ITEM_SIZE * index,
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
    fontWeight: theme.typography.weights.bold,
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
