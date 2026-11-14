import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, Flame } from 'lucide-react-native';
import { theme } from '../../theme';
import { useNutritionStore } from '../../store/nutritionStore';
import { useProfileStore } from '../../store/profileStore';
import { endOfWeek, startOfWeek, toLocalDateKey } from '../../utils/date';
import { formatCalories } from '../../utils/format';
import { computeCalorieTarget } from '../nutrition/energyFormulas';
import { ActivityPeriod } from './muscleActivity';

interface HomeCalorieCardProps {
  period?: ActivityPeriod;
  onPress: () => void;
}

export const HomeCalorieCard: React.FC<HomeCalorieCardProps> = ({
  period,
  onPress,
}) => {
  const loggedFoods = useNutritionStore((s) => s.loggedFoods);
  const fetchNutritionData = useNutritionStore((s) => s.fetchNutritionData);
  const profile = useProfileStore((s) => s.profile);
  const fetchProfile = useProfileStore((s) => s.fetchProfile);

  useEffect(() => {
    fetchNutritionData();
    fetchProfile();
  }, [fetchNutritionData, fetchProfile]);

  const targetKcal = useMemo(() => computeCalorieTarget(profile), [profile]);

  const { dailyCalories, weeklyCalories, weeklyAverage } = useMemo(() => {
    const today = new Date();
    const todayKey = toLocalDateKey(today);
    const weekStartKey = toLocalDateKey(startOfWeek(today));
    const weekEndKey = toLocalDateKey(endOfWeek(today));

    let daily = 0;
    let weekly = 0;

    for (const entry of loggedFoods) {
      if (entry.dateString === todayKey) {
        daily += entry.macros.calories;
      }
      if (entry.dateString >= weekStartKey && entry.dateString <= weekEndKey) {
        weekly += entry.macros.calories;
      }
    }

    // Days elapsed in the current week (1 for Monday up to 7 for Sunday)
    const dayOfWeek = ((today.getDay() + 6) % 7) + 1;
    const avg = weekly > 0 ? Math.round(weekly / dayOfWeek) : 0;

    return {
      dailyCalories: Math.round(daily),
      weeklyCalories: Math.round(weekly),
      weeklyAverage: avg,
    };
  }, [loggedFoods]);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="View nutrition details"
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.iconCircle}>
            <Flame size={13} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>Calories</Text>
        </View>
        <View style={styles.actionRow}>
          <Text style={styles.actionText}>Nutrition</Text>
          <ChevronRight size={14} color={theme.colors.textSecondary} />
        </View>
      </View>

      <View style={styles.statsRow}>
        {/* Today's Calories */}
        <View
          style={[
            styles.statCol,
            period === 'daily' && styles.statColActive,
          ]}
        >
          <Text style={styles.statLabel}>Today</Text>
          <Text style={styles.statValue}>
            {formatCalories(dailyCalories)}{' '}
            <Text style={styles.statUnit}>kcal</Text>
          </Text>
          <Text style={styles.statSub} numberOfLines={1}>
            {targetKcal ? `Target: ${formatCalories(targetKcal)}` : 'No target'}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* This Week's Calories */}
        <View
          style={[
            styles.statCol,
            period === 'weekly' && styles.statColActive,
          ]}
        >
          <Text style={styles.statLabel}>This Week</Text>
          <Text style={styles.statValue}>
            {formatCalories(weeklyCalories)}{' '}
            <Text style={styles.statUnit}>kcal</Text>
          </Text>
          <Text style={styles.statSub} numberOfLines={1}>
            Avg: {formatCalories(weeklyAverage)}/day
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  statColActive: {
    backgroundColor: theme.colors.surfaceHighlight + '66',
    paddingHorizontal: 6,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.sm,
  },
  statLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  statValue: {
    color: theme.colors.text,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    marginTop: 1,
  },
  statUnit: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.regular,
    color: theme.colors.textSecondary,
  },
  statSub: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
});
