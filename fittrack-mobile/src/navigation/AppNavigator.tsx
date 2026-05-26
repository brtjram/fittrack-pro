import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, Dumbbell, UtensilsCrossed, BarChart3, Settings, Bot } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';

import { DashboardScreen } from '../screens/DashboardScreen';
import { WorkoutsScreen } from '../screens/WorkoutsScreen';
import { WorkoutDetailScreen } from '../screens/WorkoutDetailScreen';
import { NutritionScreen } from '../screens/NutritionScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { NotificationSettingsScreen } from '../screens/NotificationSettingsScreen';
import { TransformationChallengeScreen } from '../screens/TransformationChallengeScreen';
import { ChatScreen } from '../screens/ChatScreen';

const Tab = createBottomTabNavigator();
const WorkoutStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();

function WorkoutsStackNavigator() {
  const { colors } = useTheme();
  return (
    <WorkoutStack.Navigator screenOptions={{
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.foreground,
      headerShadowVisible: false,
      headerTitleStyle: { fontWeight: '700', fontSize: 17 },
    }}>
      <WorkoutStack.Screen name="WorkoutsList" component={WorkoutsScreen} options={{ headerShown: false }} />
      <WorkoutStack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} options={{ title: 'Workout' }} />
    </WorkoutStack.Navigator>
  );
}

function SettingsStackNavigator() {
  const { colors } = useTheme();
  return (
    <SettingsStack.Navigator screenOptions={{
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.foreground,
      headerShadowVisible: false,
      headerTitleStyle: { fontWeight: '700', fontSize: 17 },
    }}>
      <SettingsStack.Screen name="SettingsMain" component={SettingsScreen} options={{ headerShown: false }} />
      <SettingsStack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: 'Notifications' }} />
      <SettingsStack.Screen name="TransformationChallenge" component={TransformationChallengeScreen} options={{ title: '12-Week Challenge' }} />
    </SettingsStack.Navigator>
  );
}

function TabIcon({ icon, label, focused, colors }: { icon: React.ReactNode; label: string; focused: boolean; colors: any }) {
  return (
    <View style={[tabStyles.iconWrap, focused && { backgroundColor: colors.primary + '18' }]}>
      {icon}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrap: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, alignItems: 'center', justifyContent: 'center' },
});

export function AppNavigator() {
  const { colors, isDark } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarStyle: {
          backgroundColor: isDark ? '#111111' : colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarActiveTintColor: isDark ? colors.primary : colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: 2, letterSpacing: 0.2 },
        tabBarShowLabel: true,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
      })}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              icon={<Home size={22} color={color} strokeWidth={focused ? 2.5 : 2} />}
              label="Home"
              focused={focused}
              colors={colors}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Train"
        component={WorkoutsStackNavigator}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              icon={<Dumbbell size={22} color={color} strokeWidth={focused ? 2.5 : 2} />}
              label="Train"
              focused={focused}
              colors={colors}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Eat"
        component={NutritionScreen}
        options={{
          title: 'Nutrition',
          headerTitle: 'Nutrition',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              icon={<UtensilsCrossed size={22} color={color} strokeWidth={focused ? 2.5 : 2} />}
              label="Eat"
              focused={focused}
              colors={colors}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Coach"
        component={ChatScreen}
        options={{
          title: 'AI Coach',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              icon={<Bot size={22} color={color} strokeWidth={focused ? 2.5 : 2} />}
              label="Coach"
              focused={focused}
              colors={colors}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Stats"
        component={AnalyticsScreen}
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              icon={<BarChart3 size={22} color={color} strokeWidth={focused ? 2.5 : 2} />}
              label="Stats"
              focused={focused}
              colors={colors}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Me"
        component={SettingsStackNavigator}
        options={{
          headerShown: false,
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              icon={<Settings size={22} color={color} strokeWidth={focused ? 2.5 : 2} />}
              label="Profile"
              focused={focused}
              colors={colors}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
