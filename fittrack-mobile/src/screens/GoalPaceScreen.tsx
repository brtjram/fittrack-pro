import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, TrendingDown, Target, TrendingUp, Minus, Plus, TriangleAlert, CircleCheckBig, Sparkles } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { AppliedBanner } from '../components/ui';
import * as api from '../services/api';
import type { UserProfile, Goal } from '@fittrack/core';
import { calculateTDEE, calculateBMR } from '@fittrack/core';

const GOAL_OPTIONS: { value: Goal; label: string; icon: any }[] = [
  { value: 'fat_loss', label: 'Lose fat', icon: TrendingDown },
  { value: 'recomp', label: 'Recomp', icon: Target },
  { value: 'muscle_gain', label: 'Build muscle', icon: TrendingUp },
  { value: 'maintain', label: 'Maintain', icon: Target },
];

const PACE_OPTIONS = [0.5, 0.8, 1.2];
const KCAL_PER_LB = 3500;
const PACE_REASON_PREFIX = 'Goal & pace:';

function extractPace(reason: string | undefined | null): number | null {
  if (!reason) return null;
  const match = /Goal & pace: ([\d.]+) lb\/week/.exec(reason);
  return match ? parseFloat(match[1]) : null;
}

export function GoalPaceScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pace, setPace] = useState(0.8);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    api.getUserProfile().then((p) => {
      if (p) {
        setProfile(p);
        setPace(extractPace(JSON.parse(p.nutritionTargetOverride ?? 'null')?.reason) ?? 0.8);
      }
      setLoading(false);
    });
  }, []);

  const paceApplicable = profile?.goal === 'fat_loss' || profile?.goal === 'muscle_gain';

  const preview = useMemo(() => {
    if (!profile) return null;
    const tdee = calculateTDEE(profile);
    const bmr = calculateBMR(profile);
    if (!paceApplicable) return { calories: tdee, protein: null, tooLow: false, tdee, bmr };
    const dailyDelta = Math.round((pace * KCAL_PER_LB) / 7 / 10) * 10;
    const calories = profile.goal === 'fat_loss' ? tdee - dailyDelta : tdee + dailyDelta;
    return { calories, dailyDelta, tooLow: profile.goal === 'fat_loss' && calories < bmr, tdee, bmr };
  }, [profile, pace, paceApplicable]);

  const weightDiff = profile ? Math.abs(profile.currentWeightLbs - profile.targetWeightLbs) : 0;
  const etaWeeks = paceApplicable && pace > 0 ? Math.ceil(weightDiff / pace) : null;
  const etaDate = etaWeeks
    ? new Date(Date.now() + etaWeeks * 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const commit = useCallback(async (patch: Partial<UserProfile> & { newPace?: number }) => {
    if (!profile) return;
    const { newPace, ...profilePatch } = patch;
    const nextPace = newPace ?? pace;
    const nextProfile = { ...profile, ...profilePatch };
    const nextPaceApplicable = nextProfile.goal === 'fat_loss' || nextProfile.goal === 'muscle_gain';

    let nutritionTargetOverride = nextProfile.nutritionTargetOverride;
    if (nextPaceApplicable) {
      const tdee = calculateTDEE(nextProfile);
      const dailyDelta = Math.round((nextPace * KCAL_PER_LB) / 7 / 10) * 10;
      const calories = nextProfile.goal === 'fat_loss' ? tdee - dailyDelta : tdee + dailyDelta;
      const weightKg = nextProfile.currentWeightLbs * 0.453592;
      const protein = Math.round(2.2 * weightKg);
      const fat = Math.round((calories * 0.25) / 9);
      const carbs = Math.max(50, Math.round((calories - protein * 4 - fat * 9) / 4));
      nutritionTargetOverride = JSON.stringify({
        calories, protein, carbs, fat,
        reason: `${PACE_REASON_PREFIX} ${nextPace} lb/week`,
        setAt: new Date().toISOString().split('T')[0],
      });
    } else if (profilePatch.goal) {
      // Switching to recomp/maintain drops the pace-based override — those
      // goals use the standard fixed-percent calculation instead.
      nutritionTargetOverride = null;
    }

    const toSave = { ...nextProfile, nutritionTargetOverride };
    setProfile(toSave);
    setPace(nextPace);
    setApplied(false);
    try {
      await api.saveUserProfile({ ...toSave, id: profile.id });
      setApplied(true);
    } catch {
      setProfile(profile);
    }
  }, [profile, pace]);

  if (loading || !profile) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.signal} />
      </View>
    );
  }

  const isCoached = profile.goal === 'ai_coach' || profile.goal === 'challenge';

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.circleBtn, { backgroundColor: colors.surface }]}>
          <ChevronLeft size={19} color={colors.ink} />
        </TouchableOpacity>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink, flex: 1, marginLeft: 12 }}>Goal & pace</Text>
      </View>

      {isCoached ? (
        <View style={{ padding: 16, gap: 14 }}>
          <View style={[styles.card, { backgroundColor: colors.surface, padding: 19, alignItems: 'flex-start', gap: 10 }]}>
            <Sparkles size={19} color={colors.progress} />
            <Text style={{ fontFamily: Fonts.serif, fontSize: 19, lineHeight: 25, color: colors.ink }}>
              {profile.goal === 'ai_coach' ? 'Your AI coach sets this' : 'Your 12-week challenge sets this'}
            </Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 12.5, lineHeight: 19, color: colors.mutedForeground }}>
              {profile.goal === 'ai_coach'
                ? "Calories, protein and pace come from what you told the coach, and adjust automatically as you report progress. Open coach chat to change direction."
                : 'The current challenge phase decides your targets. Leave the challenge from its own screen to set a manual goal here instead.'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'Coach' })}
            style={[styles.applyBtn, { backgroundColor: colors.progress }]}
          >
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.canvas }}>Open coach chat</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
          <Text style={{ fontFamily: Fonts.serif, fontSize: 24, lineHeight: 28, color: colors.ink }}>What are you working toward?</Text>

          <View style={styles.goalGrid}>
            {GOAL_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = profile.goal === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => commit({ goal: opt.value })}
                  style={[
                    styles.goalChip,
                    { backgroundColor: selected ? 'rgba(201,232,74,.1)' : colors.surface, borderColor: selected ? colors.progress : colors.hairline },
                  ]}
                >
                  <Icon size={18} color={selected ? colors.progress : colors.mutedForeground} />
                  <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: selected ? colors.progress : colors.mutedForeground }}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, padding: 19 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={{ flex: 1, fontFamily: Fonts.sansMedium, fontSize: 10.5, letterSpacing: 1, color: colors.mutedForeground, textTransform: 'uppercase' }}>Target weight</Text>
              <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, color: colors.mutedForeground }}>from {profile.currentWeightLbs} lb</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 }}>
              <TouchableOpacity onPress={() => commit({ targetWeightLbs: profile.targetWeightLbs - 1 })} style={[styles.stepBtn, { backgroundColor: colors.surfaceInset }]}>
                <Minus size={16} color={colors.ink} strokeWidth={2.4} />
              </TouchableOpacity>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: Fonts.serif, fontSize: 34, color: colors.ink }}>{profile.targetWeightLbs.toFixed(1)}</Text>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: colors.mutedForeground, marginTop: 5 }}>lb · {weightDiff.toFixed(0)} lb to go</Text>
              </View>
              <TouchableOpacity onPress={() => commit({ targetWeightLbs: profile.targetWeightLbs + 1 })} style={[styles.stepBtn, { backgroundColor: colors.surfaceInset }]}>
                <Plus size={16} color={colors.ink} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          </View>

          {paceApplicable && (
            <>
              <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, letterSpacing: 1, color: colors.mutedForeground, textTransform: 'uppercase', marginTop: 4 }}>How fast</Text>
              <View style={[styles.card, { backgroundColor: colors.surface, padding: 19 }]}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {PACE_OPTIONS.map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => commit({ newPace: p })}
                      style={[styles.paceChip, { backgroundColor: pace === p ? colors.progress : colors.surfaceInset }]}
                    >
                      <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 11.5, color: pace === p ? colors.canvas : colors.mutedForeground }}>{p} lb</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, color: colors.mutedForeground, textAlign: 'center', marginTop: 9 }}>per week</Text>

                {preview && (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 17, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: 16 }}>
                    <Stat colors={colors} label="Calories" value={Math.round(preview.calories).toLocaleString()} sub={`${preview.calories < preview.tdee ? '−' : '+'}${Math.abs(Math.round(preview.calories - preview.tdee))} today`} subColor={colors.signal} />
                    <Stat colors={colors} label="You'd arrive" value={etaDate ?? '—'} sub={etaWeeks ? `${etaWeeks} weeks` : ''} subColor={colors.progress} />
                  </View>
                )}
              </View>
            </>
          )}

          {preview?.tooLow && (
            <View style={[styles.infoBanner, { backgroundColor: 'rgba(245,145,72,.1)' }]}>
              <TriangleAlert size={15} color={colors.signal} style={{ marginTop: 1 }} />
              <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, lineHeight: 17, color: colors.mutedStrong, flex: 1 }}>
                At {pace} lb a week you'd be eating below your estimated resting burn. Expect strength and recovery to suffer if you hold this long.
              </Text>
            </View>
          )}

          <View style={styles.appliedRow}><AppliedBanner visible={applied} colors={colors} /></View>
        </ScrollView>
      )}
    </View>
  );
}

function Stat({ colors, label, value, sub, subColor }: { colors: any; label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 9.5, letterSpacing: 0.8, color: colors.mutedForeground, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.ink, marginTop: 5 }}>{value}</Text>
      {sub ? <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 10.5, color: subColor ?? colors.mutedForeground, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 4, gap: 10 },
  circleBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 18 },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalChip: { flexBasis: '47%', flexGrow: 1, borderWidth: 1.5, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  stepBtn: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  paceChip: { flex: 1, alignItems: 'center', borderRadius: 10, paddingVertical: 10 },
  appliedRow: { height: 20, justifyContent: 'center' },
  infoBanner: { flexDirection: 'row', gap: 11, borderRadius: 14, padding: 15 },
  applyBtn: { alignItems: 'center', justifyContent: 'center', borderRadius: 15, paddingVertical: 16 },
});
