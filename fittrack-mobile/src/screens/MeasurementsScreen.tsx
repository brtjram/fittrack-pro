import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Heart, Info } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { NumberBubble, SegmentedControl, AppliedBanner } from '../components/ui';
import * as api from '../services/api';
import { getHealthKitStatus, getLatestBodyMetrics, requestHealthKitPermissions, setHealthKitEnabled } from '../services/healthkit';
import type { UserProfile, ActivityLevel, WeightEntry } from '@fittrack/core';
import { formatWeight, formatHeight, resolveCurrentWeight } from '@fittrack/core';

function HealthSyncedHint({ colors }: { colors: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
      <Heart size={11} color={colors.danger2} />
      <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: colors.mutedForeground }}>Synced from Apple Health</Text>
    </View>
  );
}

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very active' },
];

export function MeasurementsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [latestWeighIn, setLatestWeighIn] = useState<WeightEntry | null>(null);
  const [applied, setApplied] = useState(false);
  const [healthBodyFat, setHealthBodyFat] = useState<number | null>(null);
  const [heightFromHealth, setHeightFromHealth] = useState(false);
  const [hkAvailable, setHkAvailable] = useState(false);
  const [hkEnabled, setHkEnabled] = useState(false);
  const [connectingHealth, setConnectingHealth] = useState(false);
  const healthSyncAttempted = useRef(false);

  useEffect(() => {
    Promise.all([api.getUserProfile(), api.getWeightEntries(30)]).then(([p, weights]) => {
      setProfile(p ?? null);
      const sorted = [...weights].sort((a, b) => b.date.localeCompare(a.date));
      setLatestWeighIn(sorted[0] ?? null);
      setLoading(false);
    });
  }, []);

  const apply = useCallback(async (patch: Partial<UserProfile>) => {
    if (!profile) return;
    const next = { ...profile, ...patch };
    setProfile(next);
    setApplied(false);
    try {
      await api.saveUserProfile({ ...next, id: profile.id });
      setApplied(true);
    } catch {
      setProfile(profile);
    }
  }, [profile]);

  // Height apply reads `profile` via the `apply` closure, so this needs the
  // freshest profile snapshot passed in explicitly rather than trusting the
  // one captured when the effect/handler was defined.
  const pullHealthMetrics = useCallback(async (currentProfile: UserProfile) => {
    const metrics = await getLatestBodyMetrics();
    if (metrics.bodyFatPercent != null) setHealthBodyFat(metrics.bodyFatPercent);
    if (metrics.heightCm != null) {
      setHeightFromHealth(true);
      if (metrics.heightCm !== currentProfile.heightCm) apply({ heightCm: metrics.heightCm });
    }
  }, [apply]);

  // Health is the more trustworthy source for height/body-fat once it's
  // connected — a scale/body-comp reading beats a number typed in once and
  // never revisited. Runs once per screen visit, not on every apply().
  useEffect(() => {
    if (!profile || healthSyncAttempted.current || Platform.OS !== 'ios') return;
    healthSyncAttempted.current = true;
    (async () => {
      const status = await getHealthKitStatus();
      setHkAvailable(status.available);
      setHkEnabled(status.enabled);
      if (!status.enabled) return;
      pullHealthMetrics(profile);
    })();
  }, [profile, pullHealthMetrics]);

  const handleConnectHealth = useCallback(async () => {
    if (!profile || Platform.OS !== 'ios') return;
    setConnectingHealth(true);
    try {
      const granted = await requestHealthKitPermissions();
      if (!granted) {
        Alert.alert('Permission Required', 'Enable Health access in Settings → Privacy & Security → Health → FitTrack Pro.');
        return;
      }
      await setHealthKitEnabled(true);
      setHkEnabled(true);
      await pullHealthMetrics(profile);
    } finally {
      setConnectingHealth(false);
    }
  }, [profile, pullHealthMetrics]);

  if (loading || !profile) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.signal} />
      </View>
    );
  }

  const weightUnit = profile.weightUnit ?? 'lb';
  const heightUnit = profile.heightUnit ?? 'cm';

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.circleBtn, { backgroundColor: colors.surface }]}>
          <ChevronLeft size={19} color={colors.ink} />
        </TouchableOpacity>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink, flex: 1, marginLeft: 12 }}>Measurements</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <Text style={{ fontFamily: Fonts.serif, fontSize: 24, lineHeight: 28, color: colors.ink }}>
          The four numbers your targets are built on
        </Text>

        {hkAvailable && !hkEnabled && (
          <TouchableOpacity
            style={[styles.connectHealthRow, { backgroundColor: 'rgba(255,78,91,0.1)' }]}
            activeOpacity={0.7}
            disabled={connectingHealth}
            onPress={handleConnectHealth}
          >
            <View style={[styles.connectHealthIcon, { backgroundColor: 'rgba(255,78,91,0.16)' }]}>
              <Heart size={17} color={colors.danger2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: colors.ink }}>Connect Apple Health</Text>
              <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
                Fills in height and body fat automatically
              </Text>
            </View>
            {connectingHealth
              ? <ActivityIndicator size="small" color={colors.danger2} />
              : <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: colors.danger2 }}>Connect</Text>}
          </TouchableOpacity>
        )}

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Row colors={colors} label="Age" hint="Sets your baseline burn">
            <NumberBubble value={profile.age} unit="yrs" colors={colors} onCommit={(v) => apply({ age: Math.round(v) })} />
          </Row>
          <Row colors={colors} label="Height" bordered
            hint={heightFromHealth ? undefined : 'Fixed unless you tell us otherwise'}
            hintNode={heightFromHealth ? <HealthSyncedHint colors={colors} /> : undefined}
          >
            <NumberBubble value={profile.heightCm} unit={heightUnit === 'ftin' ? 'cm (ft/in in Units)' : 'cm'} colors={colors} onCommit={(v) => { setHeightFromHealth(false); apply({ heightCm: Math.round(v) }); }} />
          </Row>
          <Row colors={colors} label="Sex" hint="Affects the burn estimate only" bordered>
            <SegmentedControl
              colors={colors}
              value={profile.gender}
              onChange={(v) => apply({ gender: v })}
              options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
            />
          </Row>
          <Row colors={colors} label="Current weight" bordered
            hintNode={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                <Heart size={11} color={colors.danger2} />
                <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: colors.mutedForeground }}>
                  {latestWeighIn ? `From your weigh-in log · ${latestWeighIn.date}` : 'Log a weigh-in to set this'}
                </Text>
              </View>
            }
          >
            <TouchableOpacity onPress={() => navigation.getParent()?.navigate('WeighIn')}>
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.ink }}>
                {formatWeight(resolveCurrentWeight(latestWeighIn ? [latestWeighIn] : [], profile.currentWeightLbs)!, weightUnit)}
              </Text>
            </TouchableOpacity>
          </Row>
        </View>

        <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, letterSpacing: 1, color: colors.mutedForeground, textTransform: 'uppercase', marginTop: 4 }}>Optional</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Row colors={colors} label="Body fat"
            hint={healthBodyFat == null ? 'Sharpens your protein floor' : undefined}
            hintNode={healthBodyFat != null ? <HealthSyncedHint colors={colors} /> : undefined}
          >
            <TouchableOpacity onPress={() => navigation.getParent()?.navigate('AppleHealth')}>
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.ink }}>
                {healthBodyFat != null ? `${healthBodyFat}%` : latestWeighIn?.bodyFatPercent ? `${latestWeighIn.bodyFatPercent}%` : 'Not logged'}
              </Text>
            </TouchableOpacity>
          </Row>
          <View style={[styles.activityBlock, { borderTopColor: colors.hairline }]}>
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: colors.ink }}>Daily activity outside training</Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: colors.mutedForeground, marginTop: 2, marginBottom: 12 }}>
              Overridden by your step data when it syncs
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {ACTIVITY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => apply({ activityLevel: opt.value })}
                  style={[styles.activityChip, { backgroundColor: profile.activityLevel === opt.value ? colors.progress : colors.surfaceInset }]}
                >
                  <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 11.5, color: profile.activityLevel === opt.value ? colors.canvas : colors.mutedForeground }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.appliedRow}><AppliedBanner visible={applied} colors={colors} /></View>

        <View style={[styles.infoBanner, { backgroundColor: 'rgba(201,232,74,.08)' }]}>
          <Info size={15} color={colors.progress} style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, lineHeight: 17, color: colors.mutedStrong, flex: 1 }}>
            Editing any of these recalculates your daily targets straight away.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ colors, label, hint, hintNode, bordered, children }: {
  colors: any; label: string; hint?: string; hintNode?: React.ReactNode; bordered?: boolean; children: React.ReactNode;
}) {
  return (
    <View style={[styles.row, bordered && { borderTopWidth: 1, borderTopColor: colors.hairline }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: colors.ink }}>{label}</Text>
        {hint && <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>{hint}</Text>}
        {hintNode}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 4, gap: 10 },
  circleBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 18, padding: 4, overflow: 'hidden' },
  connectHealthRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14 },
  connectHealthIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  activityBlock: { padding: 16 },
  activityChip: { borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12 },
  appliedRow: { height: 20, justifyContent: 'center' },
  infoBanner: { flexDirection: 'row', gap: 11, borderRadius: 14, padding: 15 },
});
