import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, Dumbbell, Utensils, MessageCircle, Plus } from 'lucide-react-native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';

import { DashboardScreen } from '../screens/DashboardScreen';
import { WorkoutsScreen } from '../screens/WorkoutsScreen';
import { WorkoutSessionScreen } from '../screens/WorkoutSessionScreen';
import { WorkoutSummaryScreen } from '../screens/WorkoutSummaryScreen';
import { NutritionScreen } from '../screens/NutritionScreen';
import { LogFoodScreen } from '../screens/LogFoodScreen';
import { AIFoodReviewScreen } from '../screens/AIFoodReviewScreen';
import { WeighInScreen } from '../screens/WeighInScreen';
import { ProgressPhotoScreen } from '../screens/ProgressPhotoScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { StrengthDetailScreen } from '../screens/StrengthDetailScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { AppleHealthScreen } from '../screens/AppleHealthScreen';
import { NotificationSettingsScreen } from '../screens/NotificationSettingsScreen';
import { TransformationChallengeScreen } from '../screens/TransformationChallengeScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { MeasurementsScreen } from '../screens/MeasurementsScreen';
import { GoalPaceScreen } from '../screens/GoalPaceScreen';
import { SplitScheduleScreen } from '../screens/SplitScheduleScreen';
import { UnitsScreen } from '../screens/UnitsScreen';
import { CoachModeScreen } from '../screens/CoachModeScreen';
import { ExportDataScreen } from '../screens/ExportDataScreen';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();
const TrainStack = createNativeStackNavigator();
const ProgressStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const LogFoodStack = createNativeStackNavigator();

function noHeader(colors: any) {
  return {
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.foreground,
    headerShadowVisible: false,
    headerTitleStyle: { fontFamily: Fonts.sansSemiBold, fontSize: 17 },
  };
}

function TrainStackNavigator() {
  const { colors } = useTheme();
  return (
    <TrainStack.Navigator screenOptions={noHeader(colors)}>
      <TrainStack.Screen name="WorkoutsList" component={WorkoutsScreen} options={{ headerShown: false }} />
      <TrainStack.Screen name="WorkoutSession" component={WorkoutSessionScreen} options={{ headerShown: false }} />
      <TrainStack.Screen name="WorkoutSummary" component={WorkoutSummaryScreen} options={{ headerShown: false, gestureEnabled: false }} />
    </TrainStack.Navigator>
  );
}

function ProgressStackNavigator() {
  const { colors } = useTheme();
  return (
    <ProgressStack.Navigator screenOptions={noHeader(colors)}>
      <ProgressStack.Screen name="ProgressOverview" component={AnalyticsScreen} options={{ headerShown: false }} />
      <ProgressStack.Screen name="StrengthDetail" component={StrengthDetailScreen} options={{ headerShown: false }} />
    </ProgressStack.Navigator>
  );
}

function ProfileStackNavigator() {
  const { colors } = useTheme();
  return (
    <ProfileStack.Navigator screenOptions={noHeader(colors)}>
      <ProfileStack.Screen name="ProfileMain" component={SettingsScreen} options={{ headerShown: false }} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false }} />
      <ProfileStack.Screen name="AppleHealth" component={AppleHealthScreen} options={{ headerShown: false }} />
      <ProfileStack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ headerShown: false }} />
      <ProfileStack.Screen name="TransformationChallenge" component={TransformationChallengeScreen} options={{ headerShown: false }} />
      <ProfileStack.Screen name="Measurements" component={MeasurementsScreen} options={{ headerShown: false }} />
      <ProfileStack.Screen name="GoalPace" component={GoalPaceScreen} options={{ headerShown: false }} />
      <ProfileStack.Screen name="SplitSchedule" component={SplitScheduleScreen} options={{ headerShown: false }} />
      <ProfileStack.Screen name="Units" component={UnitsScreen} options={{ headerShown: false }} />
      <ProfileStack.Screen name="CoachMode" component={CoachModeScreen} options={{ headerShown: false }} />
      <ProfileStack.Screen name="ExportData" component={ExportDataScreen} options={{ headerShown: false }} />
    </ProfileStack.Navigator>
  );
}

// The "＋ Log" tab has no screen of its own — pressing it opens the root-level
// LogFood modal instead of navigating within the tab bar. This placeholder is
// never actually shown; RN Navigation requires every Tab.Screen to have one.
function LogPlaceholder() {
  return <View />;
}

// One modal entry for the whole "add food" task — capture (photo/describe/
// barcode) then confirm — rather than two separately-modal screens stacked
// on top of each other. AIFoodReview is a plain push within this stack, so
// going from capture to confirm reads as one continuous sheet, not a modal
// popping up on top of another modal.
function LogFoodStackNavigator() {
  return (
    <LogFoodStack.Navigator screenOptions={{ headerShown: false }}>
      <LogFoodStack.Screen name="LogFoodMain" component={LogFoodScreen} />
      <LogFoodStack.Screen name="AIFoodReview" component={AIFoodReviewScreen} />
    </LogFoodStack.Navigator>
  );
}

function LogFabButton({ colors, onPress }: { colors: any; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={fabStyles.wrap} hitSlop={12}>
      <View style={[fabStyles.fab, { backgroundColor: colors.signal, shadowColor: colors.signal }]}>
        <Plus size={26} color={colors.signalForeground} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}

const fabStyles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', top: -16 },
  fab: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.32, shadowRadius: 20, elevation: 8,
  },
});

function TabLabel({ label, color, focused }: { label: string; color: string; focused: boolean }) {
  return (
    <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 9.5, color, marginTop: 2, letterSpacing: 0.03 }}>
      {label}
    </Text>
  );
}

function MainTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.surfaceRaised,
          borderTopColor: colors.hairline,
          borderTopWidth: 1,
          paddingTop: 10,
          height: 88,
        },
        tabBarActiveTintColor: colors.signal,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Today"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, focused }) => <Home size={21} color={color} strokeWidth={focused ? 2.2 : 2} />,
          tabBarLabel: ({ color, focused }) => <TabLabel label="Today" color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Train"
        component={TrainStackNavigator}
        options={({ route }) => ({
          tabBarIcon: ({ color, focused }: any) => <Dumbbell size={21} color={color} strokeWidth={focused ? 2.2 : 2} />,
          tabBarLabel: ({ color, focused }: any) => <TabLabel label="Train" color={color} focused={focused} />,
          // Full-immersion screens (in-workout, post-workout) hide the tab bar —
          // matches the design's frame, which shows no persistent nav on these.
          tabBarStyle: ['WorkoutSession', 'WorkoutSummary'].includes(getFocusedRouteNameFromRoute(route) ?? '')
            ? { display: 'none' }
            : undefined,
        })}
      />
      <Tab.Screen
        name="Log"
        component={LogPlaceholder}
        options={{
          tabBarButton: (props) => <LogFabButton colors={colors} onPress={props.onPress as () => void} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            (navigation.getParent() as any)?.navigate('LogFood');
          },
        })}
      />
      <Tab.Screen
        name="Food"
        component={NutritionScreen}
        options={{
          tabBarIcon: ({ color, focused }) => <Utensils size={21} color={color} strokeWidth={focused ? 2.2 : 2} />,
          tabBarLabel: ({ color, focused }) => <TabLabel label="Food" color={color} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Coach"
        component={ChatScreen}
        options={{
          tabBarIcon: ({ color, focused }) => <MessageCircle size={21} color={color} strokeWidth={focused ? 2.2 : 2} />,
          tabBarLabel: ({ color, focused }) => <TabLabel label="Coach" color={color} focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

// Profile lives behind the avatar in Today's header, not as a tab. Food
// capture, weigh-in, Progress and per-exercise strength detail are all
// pushed on the root stack, so they can render full-screen over the tab bar
// (Progress keeps its own back chevron in AnalyticsScreen's custom header
// since it's no longer a tab root).
export function AppNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs" component={MainTabs} />
      <RootStack.Screen name="LogFood" component={LogFoodStackNavigator} options={{ presentation: 'modal' }} />
      <RootStack.Screen name="Progress" component={ProgressStackNavigator} />
      <RootStack.Screen name="WeighIn" component={WeighInScreen} options={{ presentation: 'modal' }} />
      <RootStack.Screen name="ProgressPhotoCapture" component={ProgressPhotoScreen} options={{ presentation: 'modal' }} />
      <RootStack.Screen name="Profile" component={ProfileStackNavigator} />
    </RootStack.Navigator>
  );
}
