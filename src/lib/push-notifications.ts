import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { prisma } from '@/lib/prisma';

const expo = new Expo();

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: 'default' | null;
}

// Send a notification to a specific user
export async function sendNotificationToUser(
  userId: string,
  payload: NotificationPayload,
): Promise<{ sent: number; errors: number }> {
  const tokens = await prisma.pushToken.findMany({
    where: { userId },
    select: { token: true },
  });

  if (tokens.length === 0) return { sent: 0, errors: 0 };

  return sendNotifications(
    tokens.map((t) => t.token),
    payload,
  );
}

// Send notifications to multiple push tokens
export async function sendNotifications(
  pushTokens: string[],
  payload: NotificationPayload,
): Promise<{ sent: number; errors: number }> {
  const messages: ExpoPushMessage[] = [];

  for (const token of pushTokens) {
    if (!Expo.isExpoPushToken(token)) {
      console.warn('Invalid Expo push token:', token);
      continue;
    }

    messages.push({
      to: token,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: payload.sound ?? 'default',
      badge: payload.badge,
    });
  }

  if (messages.length === 0) return { sent: 0, errors: 0 };

  // Chunk messages (Expo recommends max 100 per request)
  const chunks = expo.chunkPushNotifications(messages);
  let sent = 0;
  let errors = 0;

  for (const chunk of chunks) {
    try {
      const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);

      for (const ticket of tickets) {
        if (ticket.status === 'ok') {
          sent++;
        } else {
          errors++;
          // If token is invalid, clean it up
          if (ticket.details?.error === 'DeviceNotRegistered') {
            const failedToken = chunk[tickets.indexOf(ticket)]?.to;
            if (typeof failedToken === 'string') {
              await prisma.pushToken.deleteMany({ where: { token: failedToken } });
            }
          }
        }
      }
    } catch (e) {
      console.error('Push notification send error:', e);
      errors += chunk.length;
    }
  }

  return { sent, errors };
}

// ==================== Notification Templates ====================

export async function sendWorkoutReminder(userId: string): Promise<void> {
  await sendNotificationToUser(userId, {
    title: 'Time to Train',
    body: "You have a workout planned for today. Let's get after it!",
    data: { screen: 'Train' },
  });
}

export async function sendNutritionReminder(userId: string, meal: string): Promise<void> {
  await sendNotificationToUser(userId, {
    title: `Log Your ${meal}`,
    body: `Don't forget to log your ${meal.toLowerCase()} to stay on track with your macros.`,
    data: { screen: 'Eat' },
  });
}

export async function sendWeightReminder(userId: string): Promise<void> {
  await sendNotificationToUser(userId, {
    title: 'Weekly Weigh-In',
    body: 'Time for your weekly weigh-in. Consistent tracking leads to better results!',
    data: { screen: 'Stats' },
  });
}

export async function sendStreakCongrats(userId: string, streak: number): Promise<void> {
  await sendNotificationToUser(userId, {
    title: `${streak}-Day Streak!`,
    body: `You've worked out ${streak} days in a row. Keep the momentum going!`,
    data: { screen: 'Home' },
  });
}

export async function sendGoalMilestone(userId: string, message: string): Promise<void> {
  await sendNotificationToUser(userId, {
    title: 'Milestone Reached',
    body: message,
    data: { screen: 'Stats' },
  });
}
