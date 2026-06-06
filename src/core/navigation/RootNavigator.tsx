import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Dumbbell } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WorkoutsTab } from '../../features/workouts/presentation/screens/WorkoutsTab';
import { theme } from '../theme/theme';

const CustomHeader = () => {
  const insets = useSafeAreaInsets();
  return (
    <View style={{
      paddingTop: insets.top + 16,
      paddingHorizontal: 16,
      paddingBottom: 16,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    }}>
      <Text style={{ fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold as any, color: theme.colors.primary }}>FitFreak</Text>
      <Text style={{ fontSize: theme.typography.sizes.xl, fontWeight: '600', color: theme.colors.text, marginTop: 4 }}>Hi Mukul</Text>
      <Text style={{ fontSize: theme.typography.sizes.lg, color: theme.colors.textSecondary }}>Track your fitness</Text>
    </View>
  );
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        headerTintColor: theme.colors.primary,
        headerTitleStyle: {
          fontWeight: theme.typography.weights.bold as any,
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
        component={WorkoutsTab} 
        options={{
          header: () => <CustomHeader />,
          tabBarIcon: ({ color, size }) => (
            <Dumbbell color={color} size={size} />
          )
        }}
      />
    </Tab.Navigator>
  );
};

export const RootNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Root" component={TabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

