import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { TrendingDown, TrendingUp, Camera, Ruler } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { Sparkline, PillButton, Divider } from '../components/ui';
import * as api from '../services/api';
import type { WeightEntry } from '@fittrack/core';

function toDateString(d?: Date): string {
  return (d ?? new Date()).toISOString().split('T')[0];
}

export function WeighInScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getWeightEntries(14).then((entries) => {
      const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
      setWeights(sorted);
      setValue(sorted.length ? sorted[sorted.length - 1].weightLbs : 170);
    }).finally(() => setLoading(false));
  }, []);

  const trend = weights.length > 0
    ? weights.slice(-7).reduce((a, w) => a + w.weightLbs, 0) / Math.min(7, weights.length)
    : value;
  const delta = value - trend;

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await api.addWeightEntry({ date: toDateString(), weightLbs: Math.round(value * 10) / 10 });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }, [value, navigation]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.signal} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, justifyContent: 'flex-end' }}>
      <View style={[styles.sheet, { backgroundColor: colors.surfaceRaised }]}>
        <View style={[styles.grabber, { backgroundColor: colors.surfaceInset }]} />
        <View style={styles.titleRow}>
          <Text style={{ fontFamily: Fonts.serif, fontSize: 25, color: colors.ink }}>This morning</Text>
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12, color: colors.mutedForeground }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
        </View>

        <View style={styles.readout}>
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: colors.faint }}>{(value + 0.8).toFixed(1)}</Text>
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 19, color: colors.mutedStrong }}>{(value + 0.4).toFixed(1)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
            <TouchableOpacity onPress={() => setValue((v) => Math.round((v - 0.2) * 10) / 10)} style={[styles.adjustBtn, { backgroundColor: colors.surfaceInset }]}>
              <Text style={{ color: colors.mutedStrong, fontSize: 20, fontFamily: Fonts.sansSemiBold }}>–</Text>
            </TouchableOpacity>
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 52, color: colors.ink, letterSpacing: -1.5 }}>
              {value.toFixed(1)}
            </Text>
            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 16, color: colors.mutedForeground }}>lb</Text>
            <TouchableOpacity onPress={() => setValue((v) => Math.round((v + 0.2) * 10) / 10)} style={[styles.adjustBtn, { backgroundColor: colors.surfaceInset }]}>
              <Text style={{ color: colors.mutedStrong, fontSize: 20, fontFamily: Fonts.sansSemiBold }}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 19, color: colors.mutedStrong }}>{(value - 0.4).toFixed(1)}</Text>
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: colors.faint }}>{(value - 0.8).toFixed(1)}</Text>
        </View>

        <View style={[styles.trendCard, { backgroundColor: colors.surface }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            {delta <= 0 ? <TrendingDown size={15} color={colors.progress} strokeWidth={2.4} /> : <TrendingUp size={15} color={colors.signal} strokeWidth={2.4} />}
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.ink }}>
              {Math.abs(delta).toFixed(1)} lb {delta <= 0 ? 'under' : 'over'} your trend
            </Text>
          </View>
          {weights.length >= 2 && <Sparkline values={[...weights.map((w) => w.weightLbs), value]} width={296} height={56} color={colors.progress} dotColor={colors.faint} />}
          <Divider colors={colors} />
          <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, lineHeight: 18, color: colors.mutedForeground, marginTop: 11 }}>
            One reading never moves your targets — the trend line does. Weigh in most mornings and the noise takes care of itself.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: colors.surface }]}
            onPress={() => Alert.alert('Progress photo', 'Not available yet — coming in a future update.')}
          >
            <Camera size={16} color={colors.mutedStrong} />
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: colors.mutedStrong }}>Progress photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: colors.surface }]}
            onPress={() => Alert.alert('Waist measurement', 'Not available yet — coming in a future update.')}
          >
            <Ruler size={16} color={colors.mutedStrong} />
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: colors.mutedStrong }}>Waist</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 18 }}>
          <PillButton label={saving ? 'Saving…' : 'Save weigh-in'} colors={colors} onPress={save} disabled={saving} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 40 },
  grabber: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  readout: { alignItems: 'center', marginTop: 18, gap: 2 },
  adjustBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  trendCard: { borderRadius: 16, padding: 16, marginTop: 18 },
  quickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 13, paddingVertical: 14 },
});
