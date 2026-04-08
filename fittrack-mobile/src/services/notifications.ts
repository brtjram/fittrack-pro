import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ==================== Permissions ====================

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'FitTrack Pro',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366f1',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ==================== Push Token ====================

export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Push notifications only work on physical devices');
    return null;
  }

  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      ...(projectId ? { projectId } : {}),
    });
    return tokenData.data;
  } catch (e) {
    console.warn('Failed to get push token:', e);
    return null;
  }
}

// ==================== Local Notifications ====================

export async function scheduleWorkoutReminder(hour = 9, minute = 0): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to Train',
      body: "Your workout is waiting. Let's crush it today!",
      data: { screen: 'Train' },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  return id;
}

export async function scheduleMealReminder(
  meal: string,
  hour: number,
  minute = 0,
): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Log Your ${meal}`,
      body: `Don't forget to log your ${meal.toLowerCase()} to stay on track.`,
      data: { screen: 'Eat' },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  return id;
}

export async function scheduleWeeklyWeighIn(
  weekday = 1, // Monday
  hour = 8,
  minute = 0,
): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Weekly Weigh-In',
      body: 'Time for your weekly weigh-in. Consistent tracking = better results!',
      data: { screen: 'Stats' },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday,
      hour,
      minute,
    },
  });
  return id;
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledNotifications() {
  return Notifications.getAllScheduledNotificationsAsync();
}

// ==================== Notification Listeners ====================

export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void,
) {
  return Notifications.addNotificationReceivedListener(handler);
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
