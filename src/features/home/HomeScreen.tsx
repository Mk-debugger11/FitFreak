import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Button, ModalSheet, SegmentedControl } from '../../components';
import { MuscleId } from '../../constants/muscles';
import { TabParamList } from '../../core/Navigation';
import { useActiveWorkoutStore } from '../../store/activeWorkoutStore';
import { theme } from '../../theme';
import { endOfWeek, startOfWeek } from '../../utils/date';
import { BodyViewer } from './BodyViewer';
import { ActivityPeriod } from './muscleActivity';
import { MuscleDetailSheet } from './MuscleDetailSheet';
import { MuscleLegend } from './MuscleLegend';
import { MuscleSummary } from './MuscleSummary';
import { HomeCalorieCard } from './HomeCalorieCard';
import { useMuscleActivity } from './useMuscleActivity';

const PERIOD_OPTIONS: readonly { value: ActivityPeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const ANATOMY_CREDITS = [
  'Z-Anatomy — The libre 3D atlas of anatomy — CC-BY-SA 4.0',
  'BodyParts3D — The Database Center for Life Science — CC-BY-SA 2.1 Japan',
  'Prepared from free-muscles (MIT / CC-BY-SA 4.0).',
] as const;

const formatDayMonth = (date: Date): string =>
  `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`;

const formatPeriodLabel = (period: ActivityPeriod, referenceDate: Date): string => {
  if (period === 'daily') {
    return `Today, ${formatDayMonth(referenceDate)}`;
  }
  const weekStart = startOfWeek(referenceDate);
  const weekEnd = endOfWeek(referenceDate);
  return `${formatDayMonth(weekStart)} – ${formatDayMonth(weekEnd)}`;
};

/**
 * Primary Home screen hosting the interactive 3D muscle map, daily/weekly
 * period toggle, muscle legend, and detail sheet.
 */
export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const [period, setPeriod] = useState<ActivityPeriod>('daily');
  const [view, setView] = useState<'front' | 'back'>('front');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleId | null>(null);
  const [creditsVisible, setCreditsVisible] = useState(false);

  const activity = useMuscleActivity(period);
  const hasActiveWorkout = useActiveWorkoutStore((s) => Boolean(s.currentWorkout));
  const resumeWorkout = useActiveWorkoutStore((s) => s.resumeWorkout);

  const dateLabel = formatPeriodLabel(period, new Date());
  const selectedEntry = selectedMuscle ? (activity.muscles[selectedMuscle] ?? null) : null;

  const handleStartWorkout = () => {
    if (hasActiveWorkout) {
      resumeWorkout();
      return;
    }
    navigation.navigate('Workout');
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <SegmentedControl
          options={PERIOD_OPTIONS}
          value={period}
          onChange={setPeriod}
          style={styles.periodControl}
        />
        <Text style={styles.dateLabel} numberOfLines={1}>
          {dateLabel}
        </Text>
      </View>

      <HomeCalorieCard
        period={period}
        onPress={() => navigation.navigate('Nutrition')}
      />

      <View style={styles.viewerContainer}>
        <BodyViewer
          muscles={activity.muscles}
          selectedMuscle={selectedMuscle}
          view={view}
          onChangeView={setView}
          onSelectMuscle={setSelectedMuscle}
          onOpenCredits={() => setCreditsVisible(true)}
        />
      </View>

      <View style={styles.bottomStrip}>
        <MuscleLegend />
        <MuscleSummary
          period={period}
          totals={activity.totals}
          unmapped={activity.unmapped}
          muscles={activity.muscles}
          selectedMuscle={selectedMuscle}
          onSelectMuscle={setSelectedMuscle}
          onStartWorkout={handleStartWorkout}
        />
      </View>

      <MuscleDetailSheet
        muscleId={selectedMuscle}
        entry={selectedEntry}
        period={period}
        onClose={() => setSelectedMuscle(null)}
      />

      <ModalSheet
        visible={creditsVisible}
        title="Anatomy Model Credits"
        footer={
          <Button
            title="Close"
            onPress={() => setCreditsVisible(false)}
            style={styles.creditsCloseButton}
          />
        }
      >
        <View style={styles.creditsBody}>
          {ANATOMY_CREDITS.map((line) => (
            <Text key={line} style={styles.creditsLine}>
              {line}
            </Text>
          ))}
        </View>
      </ModalSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  periodControl: {
    flexShrink: 0,
  },
  dateLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    flexShrink: 1,
    textAlign: 'right',
  },
  viewerContainer: {
    flex: 1,
    marginVertical: theme.spacing.sm,
  },
  bottomStrip: {
    gap: theme.spacing.sm,
  },
  creditsBody: {
    gap: theme.spacing.sm,
  },
  creditsLine: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    lineHeight: 20,
  },
  creditsCloseButton: {
    marginTop: theme.spacing.md,
  },
});
