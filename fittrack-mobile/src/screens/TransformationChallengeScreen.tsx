import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, StyleSheet, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Flame, Trophy, ChevronLeft, Footprints, Dumbbell, Utensils,
  CircleCheckBig, Anchor, LogOut, Check,
} from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { AppliedBanner } from '../components/ui';
import * as api from '../services/api';
import {
  CHALLENGE_PHASES as CORE_PHASES,
  getChallengePhase as coreGetPhase,
  getChallengeWeekTargets as getWeekTargets,
  type ChallengePhase as CoreChallengePhase,
  type ChallengePhaseColor,
} from '@fittrack/core';

interface WeeklyCheckIn {
  week: number;
  endWeight?: number;
  avgDailySteps?: number;
  workoutsCompleted?: number;
  workoutsTargeted?: number;
  foodComplianceDays?: number;
  notes?: string;
}

interface Challenge {
  id: string;
  startDate: string;
  startWeightLbs: number;
  targetWeightLbs: number;
  currentWeek: number;
  isActive: boolean;
  weeklyData: WeeklyCheckIn[];
}

const COLOR_HEX: Record<ChallengePhaseColor, string> = {
  blue: '#6C9FD4',
  amber: '#F59148',
  red: '#E4574C',
};

type MobileChallengePhase = Omit<CoreChallengePhase, 'color'> & { color: string };

function withColor(phase: CoreChallengePhase): MobileChallengePhase {
  return { ...phase, color: COLOR_HEX[phase.color] };
}

function getPhase(week: number): MobileChallengePhase {
  return withColor(coreGetPhase(week));
}

const PHASE_ICONS = [CircleCheckBig, Flame, Anchor];

export function TransformationChallengeScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [weighInsThisWeek, setWeighInsThisWeek] = useState(0);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkIn, setCheckIn] = useState<WeeklyCheckIn>({ week: 1 });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTransformationChallenge();
      setChallenge(data);
      if (data) {
        setCheckIn({ week: data.currentWeek });
        const weekStart = new Date(data.startDate);
        weekStart.setDate(weekStart.getDate() + (data.currentWeek - 1) * 7);
        const weights = await api.getWeightEntries(14);
        const count = weights.filter((w) => {
          const d = new Date(w.date);
          const diffDays = Math.floor((d.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays < 7;
        }).length;
        setWeighInsThisWeek(count);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startChallenge = async () => {
    Alert.alert(
      'Start 12-Week Transformation',
      'This will set you on a 3-month body transformation journey focused on maximum fat loss while preserving muscle. Your current weight will be recorded as the starting point.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Challenge', onPress: async () => {
            setSaving(true);
            try {
              const data = await api.startTransformationChallenge();
              setChallenge(data);
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const endChallenge = () => {
    Alert.alert('Leave the challenge', 'Are you sure you want to end the transformation challenge?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          try {
            await api.endTransformationChallenge();
            setChallenge(null);
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Could not end challenge. Please try again.');
          }
        },
      },
    ]);
  };

  const submitCheckIn = async () => {
    if (!challenge) return;
    setSaving(true);
    try {
      const nextWeek = Math.min(challenge.currentWeek + 1, 12);
      const updated = await api.updateTransformationChallenge({
        currentWeek: nextWeek,
        weeklyCheckIn: checkIn,
      });
      setChallenge(updated);
      setShowCheckIn(false);
      setCheckIn({ week: nextWeek });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.signal} />
      </View>
    );
  }

  if (!challenge || !challenge.isActive) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.circleBtn, { backgroundColor: colors.surface }]}>
            <ChevronLeft size={19} color={colors.ink} />
          </TouchableOpacity>
          <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink, flex: 1, marginLeft: 12 }}>12-week challenge</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
          <View style={[styles.card, { backgroundColor: colors.surface, padding: 24, alignItems: 'center', gap: 12 }]}>
            <Flame size={40} color={colors.signal} />
            <Text style={{ fontFamily: Fonts.serif, fontSize: 20, color: colors.ink, textAlign: 'center' }}>12-Week Transformation</Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 12.5, lineHeight: 19, color: colors.mutedForeground, textAlign: 'center' }}>
              A structured program to maximize fat loss while preserving muscle — close tracking of steps, food, and training, with the plan sharpening every phase.
            </Text>
          </View>
          {CORE_PHASES.map((p, i) => {
            const Icon = PHASE_ICONS[i];
            const color = COLOR_HEX[p.color];
            return (
              <View key={p.phase} style={[styles.card, { backgroundColor: colors.surface, padding: 16, borderLeftWidth: 3, borderLeftColor: color }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Icon size={16} color={color} />
                  <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color }}>Weeks {p.weeks} · {p.label}</Text>
                </View>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, lineHeight: 17, color: colors.mutedForeground, marginTop: 8 }}>{p.desc}</Text>
              </View>
            );
          })}
          <TouchableOpacity onPress={startChallenge} disabled={saving} style={[styles.startBtn, { backgroundColor: colors.signal }]}>
            {saving ? <ActivityIndicator color={colors.signalForeground} /> : <Flame size={18} color={colors.signalForeground} />}
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.signalForeground }}>{saving ? 'Starting…' : 'Start Transformation'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  const phase = getPhase(challenge.currentWeek);
  const targets = getWeekTargets(challenge.currentWeek, challenge.startWeightLbs, challenge.targetWeightLbs);
  const lastCheckIn = challenge.weeklyData[challenge.weeklyData.length - 1] as WeeklyCheckIn | undefined;
  const compliantWeeks = challenge.weeklyData.filter((w) => (w.foodComplianceDays ?? 0) >= 5).length;
  const missedWeeks = challenge.weeklyData.length - compliantWeeks;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.circleBtn, { backgroundColor: colors.surface }]}>
          <ChevronLeft size={19} color={colors.ink} />
        </TouchableOpacity>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink, flex: 1, marginLeft: 12 }}>12-week challenge</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 9 }}>
            <Text style={{ fontFamily: Fonts.serif, fontSize: 30, color: colors.ink }}>Week {challenge.currentWeek}</Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: colors.mutedForeground }}>of 12 · {phase.label}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 3, marginTop: 14 }}>
            {Array.from({ length: 12 }, (_, i) => {
              const weekNum = i + 1;
              const done = weekNum < challenge.currentWeek;
              const current = weekNum === challenge.currentWeek;
              return (
                <View key={i} style={{
                  flex: 1, height: 7, borderRadius: 4,
                  backgroundColor: done ? colors.progress : current ? phase.color : colors.hairline,
                }} />
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 }}>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 10.5, color: colors.faint }}>Started {new Date(challenge.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
            <TouchableOpacity onPress={endChallenge}>
              <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 10.5, color: colors.mutedForeground }}>Leave challenge</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, padding: 19 }]}>
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 10.5, letterSpacing: 1, color: colors.mutedForeground, textTransform: 'uppercase' }}>This week asks for</Text>
          <View style={styles.statGrid}>
            <StatTile colors={colors} label="Sessions" value={`${lastCheckIn?.workoutsCompleted ?? 0}`} suffix={`/ ${targets.workoutsPerWeek} done`} />
            <StatTile colors={colors} label="On-plan days" value={`${lastCheckIn?.foodComplianceDays ?? 0}`} suffix={`/ ${targets.complianceDays} hit`} />
            <StatTile colors={colors} label="Weigh-ins" value={`${weighInsThisWeek}`} suffix="/ 7" highlight={weighInsThisWeek >= 6} color={colors} />
            <StatTile colors={colors} label="Steps avg" value={lastCheckIn?.avgDailySteps ? `${(lastCheckIn.avgDailySteps / 1000).toFixed(1)}k` : '—'} suffix={`/ ${(targets.steps / 1000).toFixed(0)}k`} />
          </View>
        </View>

        <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, letterSpacing: 1, color: colors.mutedForeground, textTransform: 'uppercase', marginTop: 4 }}>The block</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {CORE_PHASES.map((p, i) => {
            const Icon = PHASE_ICONS[i];
            const color = COLOR_HEX[p.color];
            const isCurrent = phase.phase === p.phase;
            const isPast = phase.phase > p.phase;
            return (
              <View key={p.phase} style={[
                styles.phaseRow,
                i > 0 && { borderTopWidth: 1, borderTopColor: colors.hairline },
                isCurrent && { backgroundColor: `${color}12` },
              ]}>
                <Icon size={17} color={isPast ? colors.progress : isCurrent ? color : colors.faint} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: isCurrent ? colors.ink : isPast ? colors.mutedStrong : colors.mutedForeground }}>
                    Weeks {p.weeks} · {p.label}
                  </Text>
                  <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: isCurrent ? colors.mutedForeground : colors.faint, marginTop: 2 }} numberOfLines={1}>{p.desc}</Text>
                </View>
                {isCurrent && <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11.5, color }}>now</Text>}
              </View>
            );
          })}
        </View>

        {challenge.weeklyData.length > 0 && (
          <View style={[styles.infoBanner, { backgroundColor: 'rgba(201,232,74,.08)' }]}>
            <Trophy size={15} color={colors.progress} style={{ marginTop: 1 }} />
            <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, lineHeight: 17, color: colors.mutedStrong, flex: 1 }}>
              You finish the challenge by staying on-plan most days each week.
              {missedWeeks > 0 ? ` You've fallen short ${missedWeeks} week${missedWeeks === 1 ? '' : 's'} so far.` : " You're on track every week so far."}
            </Text>
          </View>
        )}

        {showCheckIn ? (
          <View style={[styles.card, { backgroundColor: colors.surface, padding: 18, borderWidth: 1.5, borderColor: phase.color }]}>
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink, marginBottom: 4 }}>Week {challenge.currentWeek} check-in</Text>
            <CheckInField colors={colors} label="Weight this morning (lbs)" value={checkIn.endWeight} onChange={(v) => setCheckIn((c) => ({ ...c, endWeight: v }))} keyboardType="decimal-pad" />
            <CheckInField colors={colors} label="Avg daily steps" value={checkIn.avgDailySteps} onChange={(v) => setCheckIn((c) => ({ ...c, avgDailySteps: v }))} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <CheckInField colors={colors} label="Workouts done" value={checkIn.workoutsCompleted} onChange={(v) => setCheckIn((c) => ({ ...c, workoutsCompleted: v }))} />
              </View>
              <View style={{ flex: 1 }}>
                <CheckInField colors={colors} label="On-plan days" value={checkIn.foodComplianceDays} onChange={(v) => setCheckIn((c) => ({ ...c, foodComplianceDays: v }))} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity onPress={() => setShowCheckIn(false)} style={[styles.cancelBtn, { backgroundColor: colors.surfaceInset }]}>
                <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.mutedForeground }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submitCheckIn} disabled={saving} style={[styles.submitBtn, { backgroundColor: phase.color }]}>
                {saving ? <ActivityIndicator color="#0E0D0B" /> : <Check size={15} color="#0E0D0B" strokeWidth={2.6} />}
                <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: '#0E0D0B' }}>Save & advance</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setShowCheckIn(true)} style={[styles.checkInBtn, { backgroundColor: phase.color }]}>
            <Trophy size={17} color="#0E0D0B" />
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: '#0E0D0B' }}>Week {challenge.currentWeek} check-in</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function StatTile({ colors, label, value, suffix, highlight }: { colors: any; label: string; value: string; suffix: string; highlight?: boolean; color?: any }) {
  return (
    <View style={[styles.statTile, { backgroundColor: colors.surfaceInset }]}>
      <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 9.5, letterSpacing: 0.7, color: colors.mutedForeground, textTransform: 'uppercase' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 6 }}>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 17, color: highlight ? colors.progress : colors.ink }}>{value}</Text>
        <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, color: colors.mutedForeground }}>{suffix}</Text>
      </View>
    </View>
  );
}

function CheckInField({ colors, label, value, onChange, keyboardType = 'numeric' }: {
  colors: any; label: string; value: number | undefined; onChange: (v: number | undefined) => void; keyboardType?: 'numeric' | 'decimal-pad';
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 10.5, letterSpacing: 0.5, color: colors.mutedForeground, textTransform: 'uppercase', marginBottom: 5 }}>{label}</Text>
      <TextInput
        style={{ borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: Fonts.sans, fontSize: 14, backgroundColor: colors.surfaceInset, color: colors.ink }}
        keyboardType={keyboardType}
        placeholderTextColor={colors.mutedForeground}
        value={value?.toString() ?? ''}
        onChangeText={(v) => onChange(keyboardType === 'decimal-pad' ? parseFloat(v) || undefined : parseInt(v) || undefined)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 4, gap: 10 },
  circleBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 18, overflow: 'hidden' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  statTile: { flexBasis: '47%', flexGrow: 1, borderRadius: 13, padding: 13 },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 15 },
  infoBanner: { flexDirection: 'row', gap: 11, borderRadius: 14, padding: 15 },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 15, paddingVertical: 16 },
  checkInBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 14, paddingVertical: 15 },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 11, paddingVertical: 12 },
  submitBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11, paddingVertical: 12 },
});
