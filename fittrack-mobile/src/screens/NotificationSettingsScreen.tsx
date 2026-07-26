import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Scale, Dumbbell, Utensils, Clock, Minus, Plus } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { AppliedBanner } from '../components/ui';
import * as api from '../services/api';
import type { NotificationPrefs } from '../services/api';
import { applyNotificationSchedule, requestNotificationPermissions } from '../services/notifications';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(hour: number, minute: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h}:${minute.toString().padStart(2, '0')} ${ampm}`;
}

function nextHour(hour: number, delta: number): number {
  return ((hour + delta) % 24 + 24) % 24;
}

export function NotificationSettingsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    api.getNotificationPreferences().then((p) => {
      setPrefs(p);
      setLoading(false);
    });
  }, []);

  const commit = useCallback(async (patch: Partial<NotificationPrefs>) => {
    setPrefs((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      (async () => {
        setApplied(false);
        try {
          if (next.enabled) {
            const granted = await requestNotificationPermissions();
            if (!granted) {
              Alert.alert('Permission needed', 'Enable notifications for FitTrack Pro in your device Settings to receive reminders.');
              return;
            }
          }
          await api.saveNotificationPreferences(next);
          await applyNotificationSchedule(next);
          setApplied(true);
        } catch {
          Alert.alert('Error', 'Failed to save. Please try again.');
        }
      })();
      return next;
    });
  }, []);

  if (loading || !prefs) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.signal} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.circleBtn, { backgroundColor: colors.surface }]}>
          <ChevronLeft size={19} color={colors.ink} />
        </TouchableOpacity>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink, flex: 1, marginLeft: 12 }}>Reminders</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <View>
          <Text style={{ fontFamily: Fonts.serif, fontSize: 24, lineHeight: 28, color: colors.ink }}>
            {prefs.enabled ? 'Your nudges' : 'Notifications are off'}
          </Text>
          <TouchableOpacity onPress={() => commit({ enabled: !prefs.enabled })} style={{ marginTop: 10 }}>
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: prefs.enabled ? colors.danger : colors.progress }}>
              {prefs.enabled ? 'Turn off all reminders' : 'Turn on reminders'}
            </Text>
          </TouchableOpacity>
        </View>

        {prefs.enabled && (
          <>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <ReminderRow
                colors={colors} icon={Scale} iconColor={colors.progress}
                title="Weigh-in"
                preview={`Step on before coffee — remind me ${DAY_LABELS[prefs.weighInDay]} mornings.`}
                enabled={prefs.weighInReminder}
                onToggle={(v) => commit({ weighInReminder: v })}
              >
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                  {DAY_LABELS.map((d, i) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => commit({ weighInDay: i })}
                      style={[styles.dayChip, { backgroundColor: prefs.weighInDay === i ? colors.ink : colors.surfaceInset }]}
                    >
                      <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 10.5, color: prefs.weighInDay === i ? colors.canvas : colors.mutedForeground }}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TimeStepper colors={colors} hour={prefs.weighInHour} minute={prefs.weighInMinute} onChange={(h) => commit({ weighInHour: h })} />
              </ReminderRow>

              <ReminderRow
                colors={colors} icon={Dumbbell} iconColor={colors.signal} bordered
                title="Training"
                preview="Tonight's session, with the day's prescribed lift."
                enabled={prefs.workoutReminder}
                onToggle={(v) => commit({ workoutReminder: v })}
              >
                <TimeStepper colors={colors} hour={prefs.workoutReminderHour} minute={prefs.workoutReminderMinute} onChange={(h) => commit({ workoutReminderHour: h })} />
              </ReminderRow>

              <ReminderRow
                colors={colors} icon={Utensils} iconColor={colors.mutedForeground} bordered
                title="Breakfast"
                enabled={prefs.breakfastReminder}
                onToggle={(v) => commit({ breakfastReminder: v })}
              >
                <TimeStepper colors={colors} hour={prefs.breakfastHour} minute={prefs.breakfastMinute} onChange={(h) => commit({ breakfastHour: h })} />
              </ReminderRow>

              <ReminderRow
                colors={colors} icon={Utensils} iconColor={colors.mutedForeground} bordered
                title="Lunch"
                enabled={prefs.lunchReminder}
                onToggle={(v) => commit({ lunchReminder: v })}
              >
                <TimeStepper colors={colors} hour={prefs.lunchHour} minute={prefs.lunchMinute} onChange={(h) => commit({ lunchHour: h })} />
              </ReminderRow>

              <ReminderRow
                colors={colors} icon={Utensils} iconColor={colors.mutedForeground} bordered
                title="Dinner"
                enabled={prefs.dinnerReminder}
                onToggle={(v) => commit({ dinnerReminder: v })}
              >
                <TimeStepper colors={colors} hour={prefs.dinnerHour} minute={prefs.dinnerMinute} onChange={(h) => commit({ dinnerHour: h })} />
              </ReminderRow>
            </View>

            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, letterSpacing: 1, color: colors.mutedForeground, textTransform: 'uppercase', marginTop: 4 }}>Quiet hours</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, padding: 18 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Text style={{ flex: 1, fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: colors.ink }}>Nothing between</Text>
                <View style={[styles.chip, { backgroundColor: colors.surfaceInset }]}>
                  <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.ink }}>{formatTime(prefs.quietHoursStart, 0)}</Text>
                </View>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, color: colors.mutedForeground }}>and</Text>
                <View style={[styles.chip, { backgroundColor: colors.surfaceInset }]}>
                  <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.ink }}>{formatTime(prefs.quietHoursEnd, 0)}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity onPress={() => commit({ quietHoursStart: nextHour(prefs.quietHoursStart, -1) })} style={[styles.smallStepBtn, { backgroundColor: colors.surfaceInset }]}>
                  <Minus size={13} color={colors.ink} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => commit({ quietHoursStart: nextHour(prefs.quietHoursStart, 1) })} style={[styles.smallStepBtn, { backgroundColor: colors.surfaceInset }]}>
                  <Plus size={13} color={colors.ink} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => commit({ quietHoursEnd: nextHour(prefs.quietHoursEnd, -1) })} style={[styles.smallStepBtn, { backgroundColor: colors.surfaceInset }]}>
                  <Minus size={13} color={colors.ink} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => commit({ quietHoursEnd: nextHour(prefs.quietHoursEnd, 1) })} style={[styles.smallStepBtn, { backgroundColor: colors.surfaceInset }]}>
                  <Plus size={13} color={colors.ink} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => commit({ quietHoursEnabled: !prefs.quietHoursEnabled })}
                  style={[styles.quietToggle, { backgroundColor: prefs.quietHoursEnabled ? 'rgba(201,232,74,.4)' : colors.surfaceInset }]}
                >
                  <View style={[styles.toggleThumb, { backgroundColor: prefs.quietHoursEnabled ? colors.progress : colors.faint, alignSelf: prefs.quietHoursEnabled ? 'flex-end' : 'flex-start' }]} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, lineHeight: 17, color: colors.mutedForeground, marginTop: 13, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 13 }}>
                Anything scheduled inside this window is dropped, not queued for the morning.
              </Text>
            </View>
          </>
        )}

        <View style={styles.appliedRow}><AppliedBanner visible={applied} colors={colors} /></View>
      </ScrollView>
    </View>
  );
}

function ReminderRow({ colors, icon: Icon, iconColor, title, preview, enabled, onToggle, bordered, children }: {
  colors: any; icon: any; iconColor: string; title: string; preview?: string;
  enabled: boolean; onToggle: (v: boolean) => void; bordered?: boolean; children?: React.ReactNode;
}) {
  return (
    <View style={[styles.reminderRow, bordered && { borderTopWidth: 1, borderTopColor: colors.hairline }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
        <Icon size={17} color={iconColor} style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: colors.ink }}>{title}</Text>
          {preview && <Text style={{ fontFamily: Fonts.sans, fontSize: 11, lineHeight: 16, color: colors.mutedForeground, marginTop: 3 }}>"{preview}"</Text>}
        </View>
        <TouchableOpacity onPress={() => onToggle(!enabled)} style={[styles.toggleTrack, { backgroundColor: enabled ? 'rgba(201,232,74,.4)' : colors.surfaceInset }]}>
          <View style={[styles.toggleThumb, { backgroundColor: enabled ? colors.progress : colors.faint, alignSelf: enabled ? 'flex-end' : 'flex-start' }]} />
        </TouchableOpacity>
      </View>
      {enabled && children}
    </View>
  );
}

function TimeStepper({ colors, hour, minute, onChange }: { colors: any; hour: number; minute: number; onChange: (h: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9, marginLeft: 31 }}>
      <Clock size={12} color={colors.mutedForeground} />
      <TouchableOpacity onPress={() => onChange(nextHour(hour, -1))} style={[styles.smallStepBtn, { backgroundColor: colors.surfaceInset }]}>
        <Minus size={12} color={colors.ink} />
      </TouchableOpacity>
      <View style={[styles.chip, { backgroundColor: colors.surfaceInset, minWidth: 76, alignItems: 'center' }]}>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.ink, fontVariant: ['tabular-nums'] }}>{formatTime(hour, minute)}</Text>
      </View>
      <TouchableOpacity onPress={() => onChange(nextHour(hour, 1))} style={[styles.smallStepBtn, { backgroundColor: colors.surfaceInset }]}>
        <Plus size={12} color={colors.ink} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 4, gap: 10 },
  circleBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 18, overflow: 'hidden' },
  reminderRow: { padding: 16 },
  dayChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, marginLeft: 31 },
  chip: { borderRadius: 9, paddingHorizontal: 11, paddingVertical: 7 },
  smallStepBtn: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  toggleTrack: { width: 44, height: 27, borderRadius: 14, padding: 2 },
  quietToggle: { width: 44, height: 27, borderRadius: 14, padding: 2, marginLeft: 'auto' },
  toggleThumb: { width: 23, height: 23, borderRadius: 12 },
  appliedRow: { height: 20, justifyContent: 'center' },
});
