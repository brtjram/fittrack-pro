import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Switch, Alert, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Heart, RefreshCw, CircleCheckBig, Footprints, Flame, Activity, Scale, Dumbbell, Utensils, Lock, TriangleAlert, Percent, Moon } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { SectionLabel, ListGroup, ListRow } from '../components/ui';
import { getHealthKitStatus, setHealthKitEnabled, requestHealthKitPermissions, syncHealthKitToServer, type HealthKitStatus } from '../services/healthkit';
import * as api from '../services/api';
import { resolveLatestBodyFat } from '@fittrack/core';
import type { DailyActivity } from '@fittrack/core';

export function AppleHealthScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<HealthKitStatus>({ available: false, enabled: false, lastSync: null });
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [latest, setLatest] = useState<{ steps: number | null; activeCalories: number | null; restingHeartRate: number | null; sleepHours: number | null; weight: number | null; bodyFatPercent: number | null }>({
    steps: null, activeCalories: null, restingHeartRate: null, sleepHours: null, weight: null, bodyFatPercent: null,
  });
  const [daysSynced, setDaysSynced] = useState(0);
  const [history, setHistory] = useState<DailyActivity[]>([]);
  const [noDataWarning, setNoDataWarning] = useState(false);

  const load = useCallback(async () => {
    try {
      // Settled independently — if the activities/weights fetch fails
      // transiently, that shouldn't blank out `status` back to its default
      // (available: false), which hides the enable toggle entirely.
      const [hk, activities, weights] = await Promise.allSettled([
        getHealthKitStatus(),
        api.getDailyActivities(7),
        // More than 1: body fat only rides along with a weigh-in on days a
        // smart scale actually measured it, so resolveLatestBodyFat below
        // needs enough history to find the last day that had one, not just
        // whatever the single most recent weight row happens to carry.
        api.getWeightEntries(30),
      ]);
      if (hk.status === 'fulfilled') setStatus(hk.value);
      const rawActivityList = activities.status === 'fulfilled' ? activities.value : [];
      const weightList = weights.status === 'fulfilled' ? weights.value : [];
      // A pre-fix HealthKit sync bug (see healthkit.ts) once wrote rows with
      // an unparseable date; those stale rows still exist server-side and
      // would otherwise render as "Invalid Date" here — same guard as
      // AnalyticsScreen's validActivities filter.
      const activityList = rawActivityList.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a.date));
      const sorted = [...activityList].sort((a, b) => b.date.localeCompare(a.date));
      setLatest({
        steps: sorted[0]?.steps ?? null,
        activeCalories: sorted[0]?.activeCalories ?? null,
        restingHeartRate: sorted[0]?.restingHeartRate ?? null,
        sleepHours: sorted[0]?.sleepHours ?? null,
        weight: weightList[0]?.weightLbs ?? null,
        bodyFatPercent: resolveLatestBodyFat(weightList),
      });
      setHistory(sorted);
      setDaysSynced(activityList.filter((a) => a.source === 'healthkit').length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (value: boolean) => {
    if (value) {
      if (Platform.OS !== 'ios') { Alert.alert('Not Available', 'HealthKit is only available on iOS devices.'); return; }
      const granted = await requestHealthKitPermissions();
      if (!granted) {
        Alert.alert('Permission Required', 'Enable Health access in Settings → Privacy & Security → Health → FitTrack Pro.');
        return;
      }
      await setHealthKitEnabled(true);
      setStatus((s) => ({ ...s, enabled: true }));
      handleSync();
    } else {
      await setHealthKitEnabled(false);
      setStatus((s) => ({ ...s, enabled: false }));
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      // Re-requesting is a no-op for types already granted and silent for
      // types already denied — but it's what actually surfaces the iOS
      // permission prompt for a *newly added* read type (e.g. Sleep) to
      // someone who enabled HealthKit before that type existed here.
      // Without this, initHealthKit was only ever called once at the
      // original toggle-on, so a new type would silently return empty
      // results forever instead of ever getting asked about.
      await requestHealthKitPermissions();
      const result = await syncHealthKitToServer(api.saveDailyActivity, api.addWeightEntry, 7);
      setNoDataWarning(!result.hasData);
      await load();
    } catch {
      Alert.alert('Sync Failed', 'Could not sync HealthKit data. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const notBuilt = () => Alert.alert('Writing to Health', 'Not available yet — coming in a future update.');

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.signal} />
      </View>
    );
  }

  const lastSyncFormatted = status.lastSync
    ? new Date(status.lastSync).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Never';

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.circleBtn, { backgroundColor: colors.surface }]}>
          <ChevronLeft size={19} color={colors.ink} />
        </TouchableOpacity>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink, flex: 1, marginLeft: 12 }}>Apple Health</Text>
      </View>

      <View style={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <View style={styles.heroRow}>
          <View style={[styles.heroIcon, { backgroundColor: 'rgba(255,78,91,0.13)' }]}>
            <Heart size={26} color={colors.danger2} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Fonts.serif, fontSize: 24, color: colors.ink }}>{status.enabled ? 'Connected' : 'Not connected'}</Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 12.5, lineHeight: 19, color: colors.mutedForeground, marginTop: 6 }}>
              {status.available
                ? 'Steps and weight come in on their own, so your targets stay honest even on days you forget to open the app.'
                : 'HealthKit is only available on a physical iOS device.'}
            </Text>
          </View>
        </View>

        {status.available && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink }}>Sync with Health</Text>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, color: colors.mutedForeground, marginTop: 3 }}>Last synced {lastSyncFormatted}</Text>
              </View>
              <Switch
                value={status.enabled}
                onValueChange={handleToggle}
                trackColor={{ false: colors.surfaceInset, true: 'rgba(201,232,74,0.4)' }}
                thumbColor={status.enabled ? colors.progress : colors.mutedForeground}
              />
            </View>
            {status.enabled && (
              <View style={styles.syncRow}>
                <TouchableOpacity onPress={handleSync} disabled={syncing} style={[styles.syncBtn, { backgroundColor: 'rgba(201,232,74,0.13)' }]}>
                  {syncing ? <ActivityIndicator size="small" color={colors.progress} /> : <RefreshCw size={14} color={colors.progress} strokeWidth={2.4} />}
                  <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: colors.progress }}>{syncing ? 'Syncing…' : 'Sync now'}</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                  <CircleCheckBig size={14} color={colors.progress} />
                  <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11.5, color: colors.progress }}>{daysSynced} days synced</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {noDataWarning && (
          <View style={[styles.warningCard, { backgroundColor: 'rgba(228,87,76,0.1)' }]}>
            <TriangleAlert size={15} color={colors.danger2} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontFamily: Fonts.sans, fontSize: 11.5, lineHeight: 18, color: colors.ink }}>
              Health returned no steps, calories, or heart rate for the last 7 days. iOS grants each data
              type separately — check Settings → Privacy & Security → Health → FitTrack Pro and make sure Steps,
              Active Energy, and Heart Rate are all turned on.
            </Text>
          </View>
        )}

        {status.enabled && (
          <>
            <View style={styles.sectionHeaderRow}><SectionLabel colors={colors}>Reading from Health</SectionLabel></View>
            <ListGroup colors={colors}>
              <ListRow colors={colors} chevron={false}
                icon={<Footprints size={17} color={colors.info} />} title="Steps" subtitle="Feeds your step target and rest-day calls"
                right={<Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: colors.ink }}>{latest.steps?.toLocaleString() ?? '--'}</Text>} />
              <ListRow colors={colors} chevron={false}
                icon={<Flame size={17} color={colors.signal} />} title="Active calories" subtitle="Used to check your deficit against reality"
                right={<Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: colors.ink }}>{latest.activeCalories ?? '--'}</Text>} />
              <ListRow colors={colors} chevron={false}
                icon={<Activity size={17} color={colors.danger2} />} title="Resting heart rate" subtitle="Early warning for under-recovery"
                right={<Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: colors.ink }}>{latest.restingHeartRate ? `${latest.restingHeartRate} bpm` : '--'}</Text>} />
              <ListRow colors={colors} chevron={false}
                icon={<Moon size={17} color={colors.info} />} title="Sleep" subtitle="Time asleep, not just time in bed"
                right={<Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: colors.ink }}>{latest.sleepHours ? `${latest.sleepHours} hr` : '--'}</Text>} />
              <ListRow colors={colors} chevron={false}
                icon={<Scale size={17} color={colors.progress} />} title="Body weight" subtitle="Smart-scale readings become your trend"
                right={<Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: colors.ink }}>{latest.weight ? `${latest.weight} lb` : '--'}</Text>} />
              <ListRow colors={colors} chevron={false} isLast
                icon={<Percent size={17} color={colors.progress} />} title="Body fat" subtitle="Rides along with a smart-scale weigh-in"
                right={<Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: colors.ink }}>{latest.bodyFatPercent ? `${latest.bodyFatPercent}%` : '--'}</Text>} />
            </ListGroup>

            {history.length > 0 && (
              <>
                <View style={styles.sectionHeaderRow}><SectionLabel colors={colors}>Recent sync history</SectionLabel></View>
                <ListGroup colors={colors}>
                  {history.slice(0, 7).map((a, i) => (
                    <ListRow
                      key={a.date}
                      colors={colors}
                      chevron={false}
                      isLast={i === Math.min(history.length, 7) - 1}
                      title={new Date(a.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      subtitle={a.source === 'healthkit' ? 'From Health' : 'Manual entry'}
                      right={
                        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: colors.ink }}>
                          {a.steps.toLocaleString()} steps · {a.activeCalories} cal
                        </Text>
                      }
                    />
                  ))}
                </ListGroup>
              </>
            )}

            <View style={styles.sectionHeaderRow}><SectionLabel colors={colors}>Writing back to Health</SectionLabel></View>
            <ListGroup colors={colors}>
              <ListRow colors={colors} chevron={false}
                icon={<Dumbbell size={17} color={colors.mutedStrong} />} title="Workouts" subtitle="Strength sessions appear in your rings"
                right={<Switch value={false} onValueChange={notBuilt} trackColor={{ false: colors.surfaceInset, true: colors.progress }} thumbColor={colors.mutedForeground} />} />
              <ListRow colors={colors} chevron={false} isLast
                icon={<Utensils size={17} color={colors.mutedStrong} />} title="Nutrition" subtitle="Calories and macros you log here"
                right={<Switch value={false} onValueChange={notBuilt} trackColor={{ false: colors.surfaceInset, true: colors.progress }} thumbColor={colors.mutedForeground} />} />
            </ListGroup>
          </>
        )}

        <View style={[styles.privacyCard, { backgroundColor: colors.surface }]}>
          <Lock size={15} color={colors.mutedForeground} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontFamily: Fonts.sans, fontSize: 11.5, lineHeight: 18, color: colors.mutedForeground }}>
            Health data stays on your phone unless you're signed in, and is never used for anything except your own targets. Revoke access any time in Settings → Privacy & Security → Health.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 8 },
  circleBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingHorizontal: 8, marginTop: 8 },
  heroIcon: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 18, padding: 18 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', marginTop: 15, paddingTop: 15 },
  syncBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11 },
  sectionHeaderRow: { marginTop: 8, marginBottom: 4 },
  privacyCard: { flexDirection: 'row', gap: 12, borderRadius: 16, padding: 16, marginTop: 8 },
  warningCard: { flexDirection: 'row', gap: 12, borderRadius: 16, padding: 16 },
});
