import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { TrendingDown, TrendingUp } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { Sparkline, PillButton, Divider } from '../components/ui';
import * as api from '../services/api';
import type { WeightEntry, WeightUnit } from '@fittrack/core';
import { convertWeight, convertToLbs } from '@fittrack/core';

function toDateString(d?: Date): string {
  const dt = d ?? new Date();
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function WeighInScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState(0); // always lbs — the storage/API unit
  const [unit, setUnit] = useState<WeightUnit>('lb');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const today = toDateString();

  useEffect(() => {
    Promise.all([api.getWeightEntries(14), api.getUserProfile()]).then(([entries, profile]) => {
      const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
      setWeights(sorted);
      setValue(sorted.length ? sorted[sorted.length - 1].weightLbs : 170);
      setUnit(profile?.weightUnit ?? 'lb');
    }).finally(() => setLoading(false));
  }, []);

  const trend = weights.length > 0
    ? weights.slice(-7).reduce((a, w) => a + w.weightLbs, 0) / Math.min(7, weights.length)
    : value;
  const delta = value - trend;
  const display = convertWeight(value, unit);

  // Steps by 0.2 of whichever unit is on screen (0.2 kg, not a fraction of
  // 0.2 lb converted to a fiddly kg amount) — round-trip through the display
  // unit rather than nudging the stored lbs value directly, so repeated taps
  // don't drift from floating-point conversion error.
  const step = useCallback((delta: number) => {
    setValue((v) => convertToLbs(Math.round((convertWeight(v, unit) + delta) * 10) / 10, unit));
  }, [unit]);

  const commitDraft = useCallback(() => {
    const parsed = parseFloat(draft);
    if (!Number.isNaN(parsed) && parsed > 0) {
      setValue(convertToLbs(parsed, unit));
    }
    setEditing(false);
  }, [draft, unit]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      // Waist and progress photos are logged separately from the Body tab
      // now — this only ever touches weightLbs, and omitting waistIn here
      // (rather than sending null) leaves whatever's already on today's
      // entry untouched, since the API skips undefined fields on upsert.
      await api.addWeightEntry({ date: today, weightLbs: Math.round(value * 10) / 10 });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }, [value, today, navigation]);

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
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: colors.faint }}>{(display + 0.8).toFixed(1)}</Text>
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 19, color: colors.mutedStrong }}>{(display + 0.4).toFixed(1)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
            <TouchableOpacity onPress={() => step(-0.2)} style={[styles.adjustBtn, { backgroundColor: colors.surfaceInset }]}>
              <Text style={{ color: colors.mutedStrong, fontSize: 20, fontFamily: Fonts.sansSemiBold }}>–</Text>
            </TouchableOpacity>
            {editing ? (
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onBlur={commitDraft}
                onSubmitEditing={commitDraft}
                keyboardType="decimal-pad"
                autoFocus
                selectTextOnFocus
                style={{
                  fontFamily: Fonts.sansSemiBold, fontSize: 52, color: colors.ink, letterSpacing: -1.5,
                  minWidth: 120, textAlign: 'center', padding: 0,
                }}
              />
            ) : (
              <TouchableOpacity onPress={() => { setDraft(display.toFixed(1)); setEditing(true); }}>
                <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 52, color: colors.ink, letterSpacing: -1.5 }}>
                  {display.toFixed(1)}
                </Text>
              </TouchableOpacity>
            )}
            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 16, color: colors.mutedForeground }}>{unit}</Text>
            <TouchableOpacity onPress={() => step(0.2)} style={[styles.adjustBtn, { backgroundColor: colors.surfaceInset }]}>
              <Text style={{ color: colors.mutedStrong, fontSize: 20, fontFamily: Fonts.sansSemiBold }}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 19, color: colors.mutedStrong }}>{(display - 0.4).toFixed(1)}</Text>
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 15, color: colors.faint }}>{(display - 0.8).toFixed(1)}</Text>
        </View>

        <View style={[styles.trendCard, { backgroundColor: colors.surface }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            {delta <= 0 ? <TrendingDown size={15} color={colors.progress} strokeWidth={2.4} /> : <TrendingUp size={15} color={colors.signal} strokeWidth={2.4} />}
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.ink }}>
              {convertWeight(Math.abs(delta), unit).toFixed(1)} {unit} {delta <= 0 ? 'under' : 'over'} your trend
            </Text>
          </View>
          {weights.length >= 2 && <Sparkline values={[...weights.map((w) => w.weightLbs), value]} width={296} height={56} color={colors.progress} dotColor={colors.faint} />}
          <Divider colors={colors} />
          <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, lineHeight: 18, color: colors.mutedForeground, marginTop: 11 }}>
            One reading never moves your targets — the trend line does. Weigh in most mornings and the noise takes care of itself.
          </Text>
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
});
