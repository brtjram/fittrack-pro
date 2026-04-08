import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import {
  getExpoPushToken,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  applyNotificationSchedule,
} from '../services/notifications';
import { registerPushToken, getNotificationPreferences } from '../services/api';

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

    // Load preferences from server and apply local notification schedule
    (async () => {
      try {
        const prefs = await getNotificationPreferences();
        await applyNotificationSchedule(prefs);
      } catch (e) {
        console.warn('Failed to load notification preferences:', e);
      }
    })();

    // Handle notification taps — navigate to the right screen with optional params
    responseListenerRef.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (!data?.screen || !navigationRef?.current) return;

      const screen = data.screen as string;
      const params = data.params as Record<string, unknown> | undefined;

      // Handle nested navigation (e.g., Train > WorkoutDetail)
      if (data.nestedScreen) {
        navigationRef.current.navigate(screen, {
          screen: data.nestedScreen as string,
          params,
        });
      } else {
        navigationRef.current.navigate(screen, params);
      }
    });

    // Handle foreground notifications
    receivedListenerRef.current = addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification.request.content.title);
    });

    return () => {
      responseListenerRef.current?.remove();
      receivedListenerRef.current?.remove();
    };
  }, [user, navigationRef]);
}
