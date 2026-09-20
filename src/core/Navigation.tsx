import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Dumbbell } from 'lucide-react-native';
import { theme } from '../theme';
import { AppHeader } from './AppHeader';
import { HomeTab } from './HomeTab';

export type RootStackParamList = {
  Root: undefined;
};

export type TabParamList = {
  Home: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const TabNavigator: React.FC = () => (
  <Tab.Navigator
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
      component={HomeTab}
      options={{
        header: () => <AppHeader />,
        tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} />,
      }}
    />
  </Tab.Navigator>
);

export const RootNavigator: React.FC = () => (
  <NavigationContainer>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Root" component={TabNavigator} />
    </Stack.Navigator>
  </NavigationContainer>
);
