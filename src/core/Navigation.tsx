import React from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Dumbbell, House } from 'lucide-react-native';
import {
  ActiveWorkoutSheet,
  useActiveWorkoutSheetController,
} from '../features/active-workout/ActiveWorkoutSheet';
import { MinimizedWorkoutBar } from '../features/active-workout/MinimizedWorkoutBar';
import { HomeScreen } from '../features/home/HomeScreen';
import { theme } from '../theme';
import { AppHeader } from './AppHeader';
import { WorkoutTab } from './WorkoutTab';

export type RootStackParamList = {
  Root: undefined;
};

export type TabParamList = {
  Home: undefined;
  Workout: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const WorkoutTabIcon: React.FC<{ color: string; size: number; hasActiveWorkout: boolean }> = ({
  color,
  size,
  hasActiveWorkout,
}) => (
  <View style={styles.iconWrapper}>
    <Dumbbell color={color} size={size} />
    {hasActiveWorkout && <View style={styles.activeDot} />}
  </View>
);

const TabNavigator: React.FC = () => {
  const {
    currentWorkout,
    isMinimized,
    resumeWorkout,
    miniBarPanHandlers,
    onTabBarLayout,
    sheetProps,
  } = useActiveWorkoutSheetController();
  const hasActiveWorkout = Boolean(currentWorkout);

  return (
    <View style={styles.tabHost}>
      <Tab.Navigator
        tabBar={(props) => (
          <View>
            {currentWorkout && isMinimized ? (
              <MinimizedWorkoutBar
                workout={currentWorkout}
                onResume={resumeWorkout}
                panHandlers={miniBarPanHandlers}
              />
            ) : null}
            <View onLayout={onTabBarLayout}>
              <BottomTabBar {...props} />
            </View>
          </View>
        )}
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
          },
          headerTintColor: theme.colors.primary,
          headerTitleStyle: {
            fontWeight: theme.typography.weights.bold,
          },
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textSecondary,
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            header: () => <AppHeader />,
            tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
          }}
        />
        <Tab.Screen
          name="Workout"
          component={WorkoutTab}
          options={{
            title: 'Workout',
            tabBarIcon: ({ color, size }) => (
              <WorkoutTabIcon color={color} size={size} hasActiveWorkout={hasActiveWorkout} />
            ),
          }}
        />
      </Tab.Navigator>
      <ActiveWorkoutSheet {...sheetProps} />
    </View>
  );
};

const styles = StyleSheet.create({
  tabHost: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  iconWrapper: {
    position: 'relative',
  },
  activeDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
  },
});

/** Root navigation container hosting the main bottom tabs and global active workout sheet. */
export const RootNavigator: React.FC = () => (
  <NavigationContainer>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Root" component={TabNavigator} />
    </Stack.Navigator>
  </NavigationContainer>
);
