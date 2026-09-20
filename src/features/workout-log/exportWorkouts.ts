import { Alert, Share } from 'react-native';
import { CompletedWorkout } from '../../types';
import { isSameDay, toLocalDateKey } from '../../utils/date';
import { resolveEquipmentType } from '../../utils/exercise';
import { formatSetDisplay, toErrorMessage } from '../../utils/format';

/** `{ "2026-09-20": { "Chest": { "Barbell Bench Press": ["60kg × 8"] } } }` */
type WorkoutExport = Record<string, Record<string, Record<string, string[]>>>;

const buildExport = (workouts: CompletedWorkout[], dateKey: string): WorkoutExport => {
  const byCategory: WorkoutExport[string] = {};

  workouts.forEach((workout) => {
    const category = workout.category || 'Uncategorized';
    const exerciseName = workout.name || 'Unnamed Exercise';

    byCategory[category] = byCategory[category] ?? {};
    const sets = (byCategory[category][exerciseName] = byCategory[category][exerciseName] ?? []);

    const equipmentType = resolveEquipmentType(workout.name, workout.equipmentType);
    const completedSets = workout.workoutData?.sets?.filter((set) => set.completed);

    if (completedSets) {
      completedSets.forEach((set) => {
        sets.push(formatSetDisplay(set.weight, set.reps, equipmentType));
      });
    } else {
      sets.push(`Total Sets: ${workout.totalSets}`);
    }
  });

  return { [dateKey]: byCategory };
};

/**
 * Shares every workout logged on `date` as JSON, ignoring any active category
 * filter so the export is always the full day.
 */
export const shareWorkoutsForDate = async (
  completedWorkouts: CompletedWorkout[],
  date: Date,
): Promise<void> => {
  const workouts = completedWorkouts.filter((workout) => isSameDay(workout.startTime, date));

  if (workouts.length === 0) {
    Alert.alert('No Workouts', 'There are no workouts to extract for this date.');
    return;
  }

  const dateKey = toLocalDateKey(date);

  try {
    await Share.share({
      message: JSON.stringify(buildExport(workouts, dateKey), null, 2),
      title: `Workout Extract - ${dateKey}`,
    });
  } catch (error) {
    Alert.alert('Error', toErrorMessage(error));
  }
};
