import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, StyleSheet, TextInput,
} from 'react-native';
import { Flame, Trophy, Target, TrendingDown, Check, ChevronRight, Footprints, Dumbbell, Utensils, X } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
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

// Phase numbers/copy live once in @fittrack/core (shared with web) so they can't
// drift between platforms — this just maps the shared color name to a hex value
// for React Native's style props.
const COLOR_HEX: Record<ChallengePhaseColor, string> = {
  blue: '#3b82f6',
  amber: '#f59e0b',
  red: '#ef4444',
};

type MobileChallengePhase = Omit<CoreChallengePhase, 'color'> & { color: string };

function withColor(phase: CoreChallengePhase): MobileChallengePhase {
  return { ...phase, color: COLOR_HEX[phase.color] };
}

const PHASE_INFO: MobileChallengePhase[] = CORE_PHASES.map(withColor);

function getPhase(week: number): MobileChallengePhase {
  return withColor(coreGetPhase(week));
}

export function TransformationChallengeScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkIn, setCheckIn] = useState<WeeklyCheckIn>({ week: 1 });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTransformationChallenge();
      setChallenge(data);
      if (data) setCheckIn({ week: data.currentWeek });
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
    Alert.alert('End Challenge', 'Are you sure you want to end the transformation challenge?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End', style: 'destructive', onPress: async () => {
          await api.endTransformationChallenge();
          setChallenge(null);
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

  const s = styles(colors);

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!challenge || !challenge.isActive) {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <View style={s.heroCard}>
          <Flame size={48} color="#ef4444" />
          <Text style={s.heroTitle}>12-Week Transformation</Text>
          <Text style={s.heroSubtitle}>
            A structured body transformation program to maximize fat loss while preserving muscle. Close tracking of steps, food, and training with adjustments every 4 weeks.
          </Text>
        </View>

        <View style={s.phases}>
          {PHASE_INFO.map((p) => (
            <View key={p.phase} style={[s.phaseCard, { borderLeftColor: p.color }]}>
              <Text style={[s.phaseLabel, { color: p.color }]}>Phase {p.phase} — Weeks {p.weeks}</Text>
              <Text style={[s.phaseName, { color: colors.foreground }]}>{p.label}</Text>
              <Text style={[s.phaseDesc, { color: colors.mutedForeground }]}>{p.desc}</Text>
              <View style={s.phaseTargets}>
                <PhaseTarget icon={<Footprints size={12} color={p.color} />} label={`${p.targets.steps.toLocaleString()} steps/day`} color={p.color} />
                <PhaseTarget icon={<Dumbbell size={12} color={p.color} />} label={`${p.targets.workoutsPerWeek} workouts/week`} color={p.color} />
                <PhaseTarget icon={<Utensils size={12} color={p.color} />} label={`${p.targets.complianceDays}/7 days on-plan`} color={p.color} />
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={s.startBtn} onPress={startChallenge} disabled={saving} activeOpacity={0.8}>
          {saving ? <ActivityIndicator size="small" color="white" /> : <Flame size={18} color="white" />}
          <Text style={s.startBtnText}>{saving ? 'Starting...' : 'Start Transformation'}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const phase = getPhase(challenge.currentWeek);
  const targets = getWeekTargets(challenge.currentWeek, challenge.startWeightLbs, challenge.targetWeightLbs);
  const totalLoss = challenge.startWeightLbs - challenge.targetWeightLbs;
  const progressPct = Math.min(((challenge.currentWeek - 1) / 12) * 100, 100);
  const lastCheckIn = challenge.weeklyData[challenge.weeklyData.length - 1] as WeeklyCheckIn | undefined;
  const actualLoss = lastCheckIn?.endWeight
    ? challenge.startWeightLbs - lastCheckIn.endWeight
    : 0;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={[s.headerCard, { borderColor: phase.color + '40', backgroundColor: phase.color + '10' }]}>
        <View style={s.headerRow}>
          <Flame size={24} color={phase.color} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[s.headerTitle, { color: colors.foreground }]}>Week {challenge.currentWeek} of 12</Text>
            <Text style={[s.headerPhase, { color: phase.color }]}>Phase {phase.phase}: {phase.label}</Text>
          </View>
          <TouchableOpacity onPress={endChallenge}>
            <X size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${progressPct}%` as any, backgroundColor: phase.color }]} />
        </View>
        <Text style={[s.progressLabel, { color: colors.mutedForeground }]}>
          {challenge.currentWeek - 1} of 12 weeks complete
        </Text>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <StatBox label="Start" value={`${challenge.startWeightLbs}lbs`} colors={colors} />
        <StatBox label="Lost" value={actualLoss > 0 ? `-${actualLoss.toFixed(1)}lbs` : '—'} highlight colors={colors} />
        <StatBox label="Target" value={`${challenge.targetWeightLbs}lbs`} colors={colors} />
        <StatBox label="To Go" value={`${Math.max(0, totalLoss - actualLoss).toFixed(1)}lbs`} colors={colors} />
      </View>

      {/* Phase guidance */}
      <View style={[s.section, { borderColor: colors.border }]}>
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>This Phase</Text>
        <Text style={[s.phaseDesc, { color: colors.mutedForeground }]}>{phase.desc}</Text>
      </View>

      {/* Weekly targets */}
      <View style={[s.section, { borderColor: colors.border }]}>
        <Text style={[s.sectionTitle, { color: colors.foreground }]}>Week {challenge.currentWeek} Targets</Text>
        <TargetRow icon={<Footprints size={16} color={phase.color} />} label="Daily Steps" value={`${targets.steps.toLocaleString()}+`} colors={colors} />
        <TargetRow icon={<Dumbbell size={16} color={phase.color} />} label="Workouts" value={`${targets.workoutsPerWeek}/week`} colors={colors} />
        <TargetRow icon={<Utensils size={16} color={phase.color} />} label="On-Plan Days" value={`${targets.complianceDays}/7`} colors={colors} />
        <TargetRow icon={<Target size={16} color={phase.color} />} label="Target Weight" value={`~${targets.expectedWeight}lbs`} colors={colors} />
      </View>

      {/* Weekly history */}
      {challenge.weeklyData.length > 0 && (
        <View style={[s.section, { borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Progress Log</Text>
          {challenge.weeklyData.map((w) => (
            <View key={w.week} style={[s.logRow, { borderBottomColor: colors.border }]}>
              <Text style={[s.logWeek, { color: colors.mutedForeground }]}>Wk {w.week}</Text>
              <Text style={[s.logWeight, { color: colors.foreground }]}>{w.endWeight ? `${w.endWeight}lbs` : '—'}</Text>
              <Text style={[s.logSteps, { color: colors.mutedForeground }]}>{w.avgDailySteps ? `${(w.avgDailySteps / 1000).toFixed(1)}k steps` : ''}</Text>
              <Text style={[s.logWorkouts, { color: colors.mutedForeground }]}>{w.workoutsCompleted !== undefined ? `${w.workoutsCompleted}/${w.workoutsTargeted ?? '?'} workouts` : ''}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Check-in modal inline */}
      {showCheckIn ? (
        <View style={[s.section, { borderColor: phase.color, borderWidth: 2 }]}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Week {challenge.currentWeek} Check-In</Text>

          <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>Weight this morning (lbs)</Text>
          <TextInput
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
            keyboardType="decimal-pad"
            placeholder="e.g. 183.5"
            placeholderTextColor={colors.mutedForeground}
            value={checkIn.endWeight?.toString() ?? ''}
            onChangeText={(v) => setCheckIn((c) => ({ ...c, endWeight: parseFloat(v) || undefined }))}
          />

          <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>Avg daily steps</Text>
          <TextInput
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
            keyboardType="numeric"
            placeholder="e.g. 9500"
            placeholderTextColor={colors.mutedForeground}
            value={checkIn.avgDailySteps?.toString() ?? ''}
            onChangeText={(v) => setCheckIn((c) => ({ ...c, avgDailySteps: parseInt(v) || undefined }))}
          />

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>Workouts done</Text>
              <TextInput
                style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                keyboardType="numeric"
                placeholder="e.g. 4"
                placeholderTextColor={colors.mutedForeground}
                value={checkIn.workoutsCompleted?.toString() ?? ''}
                onChangeText={(v) => setCheckIn((c) => ({ ...c, workoutsCompleted: parseInt(v) || undefined }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>On-plan food days</Text>
              <TextInput
                style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                keyboardType="numeric"
                placeholder="e.g. 5"
                placeholderTextColor={colors.mutedForeground}
                value={checkIn.foodComplianceDays?.toString() ?? ''}
                onChangeText={(v) => setCheckIn((c) => ({ ...c, foodComplianceDays: parseInt(v) || undefined }))}
              />
            </View>
          </View>

          <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>Notes (optional)</Text>
          <TextInput
            style={[s.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background, height: 60 }]}
            multiline
            placeholder="How did this week feel?"
            placeholderTextColor={colors.mutedForeground}
            value={checkIn.notes ?? ''}
            onChangeText={(v) => setCheckIn((c) => ({ ...c, notes: v }))}
          />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity
              style={[s.cancelBtn, { borderColor: colors.border }]}
              onPress={() => setShowCheckIn(false)}
            >
              <Text style={{ color: colors.mutedForeground, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.submitBtn} onPress={submitCheckIn} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator size="small" color="white" /> : <Check size={16} color="white" />}
              <Text style={{ color: 'white', fontWeight: '600', marginLeft: 6 }}>Save & Advance</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[s.checkInBtn, { backgroundColor: phase.color }]}
          onPress={() => setShowCheckIn(true)}
          activeOpacity={0.8}
        >
          <Trophy size={18} color="white" />
          <Text style={s.checkInBtnText}>Week {challenge.currentWeek} Check-In</Text>
          <ChevronRight size={16} color="white" />
        </TouchableOpacity>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function StatBox({ label, value, highlight, colors }: { label: string; value: string; highlight?: boolean; colors: any }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', padding: 10, backgroundColor: highlight ? colors.primary + '15' : colors.card, borderRadius: 10, marginHorizontal: 3 }}>
      <Text style={{ fontSize: 11, color: colors.mutedForeground, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: highlight ? colors.primary : colors.foreground }}>{value}</Text>
    </View>
  );
}

function TargetRow({ icon, label, value, colors }: { icon: React.ReactNode; label: string; value: string; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border + '60' }}>
      {icon}
      <Text style={{ flex: 1, marginLeft: 10, fontSize: 13, color: colors.foreground }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>{value}</Text>
    </View>
  );
}

function PhaseTarget({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
      {icon}
      <Text style={{ fontSize: 11, color }}>{label}</Text>
    </View>
  );
}

function styles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 14 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    heroCard: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 16, padding: 24, gap: 12, borderWidth: 1, borderColor: colors.border },
    heroTitle: { fontSize: 22, fontWeight: '800', color: colors.foreground, textAlign: 'center' },
    heroSubtitle: { fontSize: 13, color: colors.mutedForeground, textAlign: 'center', lineHeight: 20 },
    phases: { gap: 10 },
    phaseCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, borderLeftWidth: 4, borderWidth: 1, borderColor: colors.border },
    phaseLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    phaseName: { fontSize: 15, fontWeight: '700', marginTop: 2 },
    phaseDesc: { fontSize: 12, lineHeight: 18, marginTop: 4 },
    phaseTargets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef4444', borderRadius: 14, paddingVertical: 16, gap: 8 },
    startBtnText: { fontSize: 16, fontWeight: '700', color: 'white' },
    headerCard: { borderRadius: 14, padding: 14, borderWidth: 1 },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    headerPhase: { fontSize: 13, fontWeight: '600', marginTop: 1 },
    progressBar: { height: 6, backgroundColor: colors.muted, borderRadius: 3, marginTop: 12, overflow: 'hidden' },
    progressFill: { height: 6, borderRadius: 3 },
    progressLabel: { fontSize: 11, marginTop: 4 },
    statsRow: { flexDirection: 'row' },
    section: { backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1 },
    sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
    logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
    logWeek: { width: 36, fontSize: 12 },
    logWeight: { width: 70, fontSize: 12, fontWeight: '600' },
    logSteps: { flex: 1, fontSize: 11 },
    logWorkouts: { fontSize: 11 },
    checkInBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16, gap: 8 },
    checkInBtnText: { fontSize: 15, fontWeight: '700', color: 'white', flex: 1, textAlign: 'center' },
    inputLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 12 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
    cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    submitBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12 },
  });
}
