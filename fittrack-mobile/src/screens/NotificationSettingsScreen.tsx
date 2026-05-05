import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Switch,
  ActivityIndicator, Alert, StyleSheet, Platform,
} from 'react-native';
import { Bell, BellOff, Dumbbell, UtensilsCrossed, Scale, Moon, Clock, Check } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import * as api from '../services/api';
import type { NotificationPrefs } from '../services/api';
import { applyNotificationSchedule, requestNotificationPermissions } from '../services/notifications';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatTime(hour: number, minute: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h}:${minute.toString().padStart(2, '0')} ${ampm}`;
}

function nextHour(hour: number, delta: number): number {
  return ((hour + delta) % 24 + 24) % 24;
}

export function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api.getNotificationPreferences().then((p) => {
      setPrefs(p);
      setLoading(false);
    });
  }, []);

  const update = useCallback(<K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) => {
    setPrefs((prev) => prev ? { ...prev, [key]: value } : prev);
    setDirty(true);
  }, []);

  const handleSave = async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      // Request permission before scheduling if notifications are enabled
      if (prefs.enabled) {
        const granted = await requestNotificationPermissions();
        if (!granted) {
          Alert.alert(
            'Permission Required',
            'Enable notifications for FitTrack Pro in your device Settings to receive reminders.',
          );
          setSaving(false);
          return;
        }
      }
      await api.saveNotificationPreferences(prefs);
      await applyNotificationSchedule(prefs);
      setDirty(false);
      Alert.alert('Saved', 'Notification preferences updated.');
    } catch {
      Alert.alert('Error', 'Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !prefs) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.content}>
        {/* Save Button */}
        {dirty && (
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Check size={16} color={colors.primaryForeground} />
            )}
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primaryForeground, marginLeft: 6 }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Master Toggle */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            {prefs.enabled ? <Bell size={20} color={colors.primary} /> : <BellOff size={20} color={colors.mutedForeground} />}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.label, { color: colors.foreground }]}>Push Notifications</Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                {prefs.enabled ? 'Notifications are enabled' : 'All notifications are disabled'}
              </Text>
            </View>
            <Switch
              value={prefs.enabled}
              onValueChange={(v) => update('enabled', v)}
              trackColor={{ false: colors.muted, true: colors.primary + '60' }}
              thumbColor={prefs.enabled ? colors.primary : colors.mutedForeground}
            />
          </View>
        </View>

        {prefs.enabled && (
          <>
            {/* Workout Reminder */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.row}>
                <Dumbbell size={18} color={colors.primary} />
                <Text style={[styles.label, { color: colors.foreground, flex: 1, marginLeft: 10 }]}>
                  Workout Reminder
                </Text>
                <Switch
                  value={prefs.workoutReminder}
                  onValueChange={(v) => update('workoutReminder', v)}
                  trackColor={{ false: colors.muted, true: colors.primary + '60' }}
                  thumbColor={prefs.workoutReminder ? colors.primary : colors.mutedForeground}
                />
              </View>
              {prefs.workoutReminder && (
                <TimeSelector
                  label="Remind at"
                  hour={prefs.workoutReminderHour}
                  minute={prefs.workoutReminderMinute}
                  onChangeHour={(h) => update('workoutReminderHour', h)}
                  onChangeMinute={(m) => update('workoutReminderMinute', m)}
                  colors={colors}
                />
              )}
            </View>

            {/* Meal Reminders */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.row}>
                <UtensilsCrossed size={18} color={colors.primary} />
                <Text style={[styles.label, { color: colors.foreground, flex: 1, marginLeft: 10 }]}>
                  Meal Reminders
                </Text>
              </View>

              {/* Breakfast */}
              <MealToggle
                label="Breakfast"
                enabled={prefs.breakfastReminder}
                hour={prefs.breakfastHour}
                minute={prefs.breakfastMinute}
                onToggle={(v) => update('breakfastReminder', v)}
                onChangeHour={(h) => update('breakfastHour', h)}
                onChangeMinute={(m) => update('breakfastMinute', m)}
                colors={colors}
              />
              {/* Lunch */}
              <MealToggle
                label="Lunch"
                enabled={prefs.lunchReminder}
                hour={prefs.lunchHour}
                minute={prefs.lunchMinute}
                onToggle={(v) => update('lunchReminder', v)}
                onChangeHour={(h) => update('lunchHour', h)}
                onChangeMinute={(m) => update('lunchMinute', m)}
                colors={colors}
              />
              {/* Dinner */}
              <MealToggle
                label="Dinner"
                enabled={prefs.dinnerReminder}
                hour={prefs.dinnerHour}
                minute={prefs.dinnerMinute}
                onToggle={(v) => update('dinnerReminder', v)}
                onChangeHour={(h) => update('dinnerHour', h)}
                onChangeMinute={(m) => update('dinnerMinute', m)}
                colors={colors}
              />
            </View>

            {/* Weigh-In Reminder */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.row}>
                <Scale size={18} color={colors.primary} />
                <Text style={[styles.label, { color: colors.foreground, flex: 1, marginLeft: 10 }]}>
                  Weekly Weigh-In
                </Text>
                <Switch
                  value={prefs.weighInReminder}
                  onValueChange={(v) => update('weighInReminder', v)}
                  trackColor={{ false: colors.muted, true: colors.primary + '60' }}
                  thumbColor={prefs.weighInReminder ? colors.primary : colors.mutedForeground}
                />
              </View>
              {prefs.weighInReminder && (
                <>
                  {/* Day Selector */}
                  <View style={[styles.daySelector, { borderTopColor: colors.border }]}>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 8 }}>Day</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {WEEKDAYS.map((day, i) => (
                          <TouchableOpacity
                            key={day}
                            style={[
                              styles.dayChip,
                              { borderColor: prefs.weighInDay === (i + 1) % 7 ? colors.primary : colors.border },
                              prefs.weighInDay === (i + 1) % 7 && { backgroundColor: colors.primary + '15' },
                            ]}
                            onPress={() => update('weighInDay', (i + 1) % 7)}
                          >
                            <Text style={{
                              fontSize: 12, fontWeight: '600',
                              color: prefs.weighInDay === (i + 1) % 7 ? colors.primary : colors.mutedForeground,
                            }}>
                              {day.slice(0, 3)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                  <TimeSelector
                    label="Remind at"
                    hour={prefs.weighInHour}
                    minute={prefs.weighInMinute}
                    onChangeHour={(h) => update('weighInHour', h)}
                    onChangeMinute={(m) => update('weighInMinute', m)}
                    colors={colors}
                  />
                </>
              )}
            </View>

            {/* Quiet Hours */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.row}>
                <Moon size={18} color={colors.primary} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.label, { color: colors.foreground }]}>Quiet Hours</Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    Silence notifications during set hours
                  </Text>
                </View>
                <Switch
                  value={prefs.quietHoursEnabled}
                  onValueChange={(v) => update('quietHoursEnabled', v)}
                  trackColor={{ false: colors.muted, true: colors.primary + '60' }}
                  thumbColor={prefs.quietHoursEnabled ? colors.primary : colors.mutedForeground}
                />
              </View>
              {prefs.quietHoursEnabled && (
                <View style={[styles.quietRange, { borderTopColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 6 }}>From</Text>
                    <TouchableOpacity
                      style={[styles.timeBtn, { borderColor: colors.border }]}
                      onPress={() => update('quietHoursStart', nextHour(prefs.quietHoursStart, 1))}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>
                        {formatTime(prefs.quietHoursStart, 0)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ fontSize: 14, color: colors.mutedForeground, marginTop: 20 }}>to</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 6 }}>Until</Text>
                    <TouchableOpacity
                      style={[styles.timeBtn, { borderColor: colors.border }]}
                      onPress={() => update('quietHoursEnd', nextHour(prefs.quietHoursEnd, 1))}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground }}>
                        {formatTime(prefs.quietHoursEnd, 0)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

// ==================== Sub-components ====================

function TimeSelector({ label, hour, minute, onChangeHour, onChangeMinute, colors }: {
  label: string; hour: number; minute: number;
  onChangeHour: (h: number) => void; onChangeMinute: (m: number) => void; colors: any;
}) {
  return (
    <View style={[styles.timeRow, { borderTopColor: colors.border }]}>
      <Clock size={14} color={colors.mutedForeground} />
      <Text style={{ fontSize: 13, color: colors.mutedForeground, marginLeft: 6, flex: 1 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <TouchableOpacity
          style={[styles.timeStepBtn, { borderColor: colors.border }]}
          onPress={() => onChangeHour(nextHour(hour, -1))}
        >
          <Text style={{ fontSize: 14, color: colors.foreground }}>-</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground, minWidth: 70, textAlign: 'center' }}>
          {formatTime(hour, minute)}
        </Text>
        <TouchableOpacity
          style={[styles.timeStepBtn, { borderColor: colors.border }]}
          onPress={() => onChangeHour(nextHour(hour, 1))}
        >
          <Text style={{ fontSize: 14, color: colors.foreground }}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MealToggle({ label, enabled, hour, minute, onToggle, onChangeHour, onChangeMinute, colors }: {
  label: string; enabled: boolean; hour: number; minute: number;
  onToggle: (v: boolean) => void; onChangeHour: (h: number) => void;
  onChangeMinute: (m: number) => void; colors: any;
}) {
  return (
    <View style={[styles.mealSection, { borderTopColor: colors.border }]}>
      <View style={styles.row}>
        <Text style={{ fontSize: 14, color: colors.foreground, flex: 1 }}>{label}</Text>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ false: colors.muted, true: colors.primary + '60' }}
          thumbColor={enabled ? colors.primary : colors.mutedForeground}
        />
      </View>
      {enabled && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 }}>
          <Clock size={12} color={colors.mutedForeground} />
          <Text style={{ fontSize: 12, color: colors.mutedForeground, flex: 1, marginLeft: 4 }}>Remind at</Text>
          <TouchableOpacity
            style={[styles.timeStepBtn, { borderColor: colors.border }]}
            onPress={() => onChangeHour(nextHour(hour, -1))}
          >
            <Text style={{ fontSize: 14, color: colors.foreground }}>-</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, minWidth: 65, textAlign: 'center' }}>
            {formatTime(hour, minute)}
          </Text>
          <TouchableOpacity
            style={[styles.timeStepBtn, { borderColor: colors.border }]}
            onPress={() => onChangeHour(nextHour(hour, 1))}
          >
            <Text style={{ fontSize: 14, color: colors.foreground }}>+</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 15, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingTop: 12, marginTop: 12 },
  timeBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' },
  timeStepBtn: { width: 28, height: 28, borderWidth: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  mealSection: { borderTopWidth: 1, paddingTop: 12, marginTop: 12 },
  daySelector: { borderTopWidth: 1, paddingTop: 12, marginTop: 12 },
  dayChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  quietRange: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderTopWidth: 1, paddingTop: 12, marginTop: 12 },
});
