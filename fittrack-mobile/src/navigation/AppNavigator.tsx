import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, Dumbbell, UtensilsCrossed, BarChart3, Settings } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';

import { DashboardScreen } from '../screens/DashboardScreen';
import { WorkoutsScreen } from '../screens/WorkoutsScreen';
import { WorkoutDetailScreen } from '../screens/WorkoutDetailScreen';
import { NutritionScreen } from '../screens/NutritionScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const WorkoutStack = createNativeStackNavigator();

function WorkoutsStackNavigator() {
  const { colors } = useTheme();
  return (
    <WorkoutStack.Navigator screenOptions={{
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.foreground,
      headerShadowVisible: false,
    }}>
      <WorkoutStack.Screen name="WorkoutsList" component={WorkoutsScreen} options={{ title: 'Workouts' }} />
      <WorkoutStack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} options={{ title: 'Workout' }} />
    </WorkoutStack.Navigator>
  );
}

export function AppNavigator() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: 4,
          height: 56,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Train"
        component={WorkoutsStackNavigator}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Dumbbell size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Eat"
        component={NutritionScreen}
        options={{
          title: 'Nutrition',
          tabBarIcon: ({ color, size }) => <UtensilsCrossed size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Stats"
        component={AnalyticsScreen}
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, size }) => <BarChart3 size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Me"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
