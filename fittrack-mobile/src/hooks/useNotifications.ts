import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import {
  getExpoPushToken,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  scheduleWorkoutReminder,
  scheduleMealReminder,
  scheduleWeeklyWeighIn,
  cancelAllScheduledNotifications,
} from '../services/notifications';
import { registerPushToken } from '../services/api';

export function useNotifications(navigationRef?: any) {
  const { user } = useAuth();
  const responseListenerRef = useRef<any>(null);
  const receivedListenerRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;

    // Register push token with server
    (async () => {
      const token = await getExpoPushToken();
      if (token) {
        try {
          await registerPushToken(token, 'ios');
        } catch (e) {
          console.warn('Failed to register push token:', e);
        }
      }
    })();

    // Set up default local notification schedule
    (async () => {
      await cancelAllScheduledNotifications();
      await scheduleWorkoutReminder(9, 0);           // 9:00 AM daily
      await scheduleMealReminder('Breakfast', 8, 0);  // 8:00 AM
      await scheduleMealReminder('Lunch', 12, 0);     // 12:00 PM
      await scheduleMealReminder('Dinner', 18, 0);    // 6:00 PM
      await scheduleWeeklyWeighIn(1, 8, 0);           // Monday 8:00 AM
    })();

    // Handle notification taps — navigate to the right screen
    responseListenerRef.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.screen && navigationRef?.current) {
        navigationRef.current.navigate(data.screen as string);
      }
    });

    // Handle foreground notifications (logging)
    receivedListenerRef.current = addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification.request.content.title);
    });

    return () => {
      responseListenerRef.current?.remove();
      receivedListenerRef.current?.remove();
    };
  }, [user, navigationRef]);
}
