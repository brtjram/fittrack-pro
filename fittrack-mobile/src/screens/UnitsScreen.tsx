import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Info } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { SegmentedControl, AppliedBanner } from '../components/ui';
import * as api from '../services/api';
import type { UserProfile, WeightUnit, HeightUnit, EnergyUnit, WeekStart } from '@fittrack/core';
import { formatWeight, formatHeight, formatEnergy, startOfWeek } from '@fittrack/core';

export function UnitsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    api.getUserProfile().then((p) => {
      setProfile(p ?? null);
      setLoading(false);
    });
  }, []);

  const commit = useCallback(async (patch: Partial<UserProfile>) => {
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

  if (loading || !profile) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.signal} />
      </View>
    );
  }

  const weightUnit = profile.weightUnit ?? 'lb';
  const heightUnit = profile.heightUnit ?? 'cm';
  const energyUnit = profile.energyUnit ?? 'kcal';
  const weekStartsOn = profile.weekStartsOn ?? 'mon';
  const weekOf = startOfWeek(new Date(), weekStartsOn).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.circleBtn, { backgroundColor: colors.surface }]}>
          <ChevronLeft size={19} color={colors.ink} />
        </TouchableOpacity>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink, flex: 1, marginLeft: 12 }}>Units</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <Text style={{ fontFamily: Fonts.serif, fontSize: 24, lineHeight: 28, color: colors.ink }}>How you'd like numbers written</Text>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <UnitRow colors={colors} label="Weight">
            <SegmentedControl<WeightUnit> colors={colors} value={weightUnit} onChange={(v) => commit({ weightUnit: v })}
              options={[{ value: 'lb', label: 'lb' }, { value: 'kg', label: 'kg' }]} />
          </UnitRow>
          <UnitRow colors={colors} label="Height" bordered>
            <SegmentedControl<HeightUnit> colors={colors} value={heightUnit} onChange={(v) => commit({ heightUnit: v })}
              options={[{ value: 'ftin', label: 'ft/in' }, { value: 'cm', label: 'cm' }]} />
          </UnitRow>
          <UnitRow colors={colors} label="Energy" bordered>
            <SegmentedControl<EnergyUnit> colors={colors} value={energyUnit} onChange={(v) => commit({ energyUnit: v })}
              options={[{ value: 'kcal', label: 'kcal' }, { value: 'kj', label: 'kJ' }]} />
          </UnitRow>
          <UnitRow colors={colors} label="Week starts" bordered>
            <SegmentedControl<WeekStart> colors={colors} value={weekStartsOn} onChange={(v) => commit({ weekStartsOn: v })}
              options={[{ value: 'mon', label: 'Mon' }, { value: 'sun', label: 'Sun' }]} />
          </UnitRow>
        </View>

        <View style={[styles.sampleCard, { backgroundColor: colors.surface }]}>
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 10.5, letterSpacing: 1, color: colors.mutedForeground, textTransform: 'uppercase' }}>Sample</Text>
          <Text style={{ fontFamily: Fonts.serif, fontSize: 18, lineHeight: 26, color: colors.ink, marginTop: 9 }}>
            {formatWeight(profile.currentWeightLbs, weightUnit)} · {formatHeight(profile.heightCm, heightUnit)} · {formatEnergy(2450, energyUnit)} · week of {weekOf}
          </Text>
        </View>

        <View style={styles.appliedRow}><AppliedBanner visible={applied} colors={colors} /></View>

        <View style={[styles.infoBanner, { backgroundColor: 'rgba(201,232,74,.08)' }]}>
          <Info size={15} color={colors.progress} style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, lineHeight: 17, color: colors.mutedStrong, flex: 1 }}>
            This changes how numbers are displayed. Your logged history stays exactly as recorded.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function UnitRow({ colors, label, bordered, children }: { colors: any; label: string; bordered?: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.row, bordered && { borderTopWidth: 1, borderTopColor: colors.hairline }]}>
      <Text style={{ flex: 1, fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: colors.ink }}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 4, gap: 10 },
  circleBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  sampleCard: { borderRadius: 16, padding: 18 },
  appliedRow: { height: 20, justifyContent: 'center' },
  infoBanner: { flexDirection: 'row', gap: 11, borderRadius: 14, padding: 15 },
});
