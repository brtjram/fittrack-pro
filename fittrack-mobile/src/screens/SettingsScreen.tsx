import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Linking, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Pencil, User, Target, Dumbbell, Ruler, Heart, Bell, Flame, Download,
  ExternalLink, LogOut, X, Sparkles,
} from 'lucide-react-native';
import Constants from 'expo-constants';
import { useTheme } from '../theme/useTheme';
import { useAuth } from '../hooks/useAuth';
import { Fonts } from '../theme/fonts';
import { SectionLabel, ListGroup, ListRow } from '../components/ui';
import * as api from '../services/api';
import { getHealthKitStatus } from '../services/healthkit';
import { calculateMacroTargets } from '@fittrack/core/src/algorithms/macro-calculator';
import type { UserProfile, WeightEntry } from '@fittrack/core';
import type { TransformationChallenge } from '../services/api';

const SPLIT_LABEL: Record<string, string> = {
  ppl: 'PPL · 6 days', upper_lower: 'Upper/Lower · 4 days', full_body: 'Full body · 3 days', bro_split: 'Bro split · 5 days',
};
const GOAL_LABEL: Record<string, string> = {
  fat_loss: 'Losing fat', muscle_gain: 'Building muscle', recomp: 'Recomping', maintain: 'Maintaining', ai_coach: 'Coached plan', challenge: '12-week challenge',
};

// "Coached plan" on its own doesn't tell the user what they're actually
// working toward — ai_coach mode doesn't store a fat_loss/muscle_gain goal,
// it derives targets dynamically, so read the real direction off the
// current-vs-target weight instead of showing the mode name as the goal.
function goalLabel(profile: UserProfile): string {
  if (profile.goal !== 'ai_coach') return GOAL_LABEL[profile.goal] ?? 'On a plan';
  if (profile.targetWeightLbs < profile.currentWeightLbs) return GOAL_LABEL.fat_loss;
  if (profile.targetWeightLbs > profile.currentWeightLbs) return GOAL_LABEL.muscle_gain;
  return GOAL_LABEL.maintain;
}

function initials(name?: string | null): string {
  if (!name) return '·';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || parts[0]?.slice(0, 2).toUpperCase() || '·';
}

export function SettingsScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | undefined>();
  const [weeklyRate, setWeeklyRate] = useState(0);
  const [healthStatus, setHealthStatus] = useState<{ enabled: boolean; lastSync: string | null }>({ enabled: false, lastSync: null });
  const [challenge, setChallenge] = useState<TransformationChallenge | null>(null);

  const load = useCallback(async () => {
    try {
      // Settled independently — HealthKit throwing when it's unavailable
      // (every simulator, or a device that hasn't granted access) shouldn't
      // blank out profile/challenge data that loaded just fine.
      const [p, weights, hk, ch] = await Promise.allSettled([
        api.getUserProfile(),
        api.getWeightEntries(14),
        getHealthKitStatus(),
        api.getTransformationChallenge(),
      ]);
      if (p.status === 'fulfilled') setProfile(p.value);
      if (hk.status === 'fulfilled') setHealthStatus({ enabled: hk.value.enabled, lastSync: hk.value.lastSync });
      if (ch.status === 'fulfilled') setChallenge(ch.value);
      if (weights.status === 'fulfilled') {
        const sorted = [...weights.value].sort((a, b) => a.date.localeCompare(b.date));
        if (sorted.length >= 2) {
          setWeeklyRate(sorted[sorted.length - 1].weightLbs - sorted[Math.max(0, sorted.length - 8)].weightLbs);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.signal} />
      </View>
    );
  }

  const macros = profile ? calculateMacroTargets(profile) : null;
  const planSentence = profile
    ? `${goalLabel(profile)}${weeklyRate !== 0 ? ` at ${Math.abs(weeklyRate).toFixed(1)} lb a week` : ''}, ${SPLIT_LABEL[profile.preferredSplit]?.toLowerCase() ?? ''}.`
    : 'Complete your profile to get a plan.';

  const lastSyncFormatted = healthStatus.lastSync
    ? new Date(healthStatus.lastSync).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Close */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, alignItems: 'flex-end' }}>
        <TouchableOpacity onPress={() => navigation.getParent()?.goBack()} style={[styles.editBtn, { backgroundColor: colors.surface }]}>
          <X size={18} color={colors.ink} />
        </TouchableOpacity>
      </View>

      {/* Header */}
      <View style={[styles.header, { paddingTop: 4 }]}>
        <View style={[styles.avatar, { backgroundColor: colors.surfaceInset }]}>
          <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 18, color: colors.mutedStrong }}>{initials(user?.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Fonts.serif, fontSize: 24, color: colors.ink }}>{user?.name || 'Athlete'}</Text>
          <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, color: colors.mutedForeground, marginTop: 4 }}>{user?.email}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('EditProfile')} style={[styles.editBtn, { backgroundColor: colors.surface }]}>
          <Pencil size={15} color={colors.mutedStrong} />
        </TouchableOpacity>
      </View>

      {/* Plan summary */}
      <View style={[styles.planCard, { backgroundColor: colors.surface }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <SectionLabel colors={colors}>Your plan right now</SectionLabel>
          <TouchableOpacity onPress={() => navigation.navigate('GoalPace')}>
            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, color: colors.signal }}>Change</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontFamily: Fonts.serif, fontSize: 18, lineHeight: 25, color: colors.ink }}>{planSentence}</Text>
        {macros && profile && (
          <View style={styles.pillRow}>
            <Pill colors={colors} label={`${Math.round(macros.calories)} kcal`} progress />
            <Pill colors={colors} label={`${Math.round(macros.protein)}g protein`} progress />
            <Pill colors={colors} label={`${profile.currentWeightLbs} → ${profile.targetWeightLbs} lb`} />
            <Pill colors={colors} label={profile.experienceLevel.charAt(0).toUpperCase() + profile.experienceLevel.slice(1)} />
          </View>
        )}
      </View>

      <View style={styles.sectionHeaderRow}><SectionLabel colors={colors}>Body & training</SectionLabel></View>
      <ListGroup colors={colors} style={styles.groupMargin}>
        <ListRow colors={colors} icon={<User size={17} color={colors.mutedStrong} />} title="Measurements"
          detail={profile ? `${profile.age} · ${profile.heightCm}cm · ${profile.currentWeightLbs} lb` : undefined}
          onPress={() => navigation.navigate('Measurements')} />
        <ListRow colors={colors} icon={<Target size={17} color={colors.mutedStrong} />} title="Goal & pace"
          detail={profile ? goalLabel(profile) : undefined}
          onPress={() => navigation.navigate('GoalPace')} />
        <ListRow colors={colors} icon={<Dumbbell size={17} color={colors.mutedStrong} />} title="Split & schedule"
          detail={profile ? SPLIT_LABEL[profile.preferredSplit] : undefined}
          onPress={() => navigation.navigate('SplitSchedule')} />
        <ListRow
          colors={colors}
          icon={<Sparkles size={17} color={profile?.goal === 'ai_coach' ? colors.progress : colors.mutedStrong} />}
          title="Coach mode"
          subtitle={profile?.goal === 'ai_coach' ? 'AI sets targets and training from your goal' : undefined}
          right={profile?.goal === 'ai_coach' ? <Pill colors={colors} label="AI coach" progress /> : undefined}
          onPress={() => navigation.navigate('CoachMode')}
        />
        <ListRow colors={colors} icon={<Ruler size={17} color={colors.mutedStrong} />} title="Units"
          detail={`${profile?.weightUnit ?? 'lb'} · ${profile?.heightUnit ?? 'cm'}`} isLast
          onPress={() => navigation.navigate('Units')} />
      </ListGroup>

      <View style={styles.sectionHeaderRow}><SectionLabel colors={colors}>Data & reminders</SectionLabel></View>
      <ListGroup colors={colors} style={styles.groupMargin}>
        <ListRow
          colors={colors}
          icon={<Heart size={17} color={colors.danger2} />}
          title="Apple Health"
          subtitle={healthStatus.enabled ? `Synced ${lastSyncFormatted ?? 'recently'}` : 'Not connected'}
          right={healthStatus.enabled ? <View style={[styles.statusDot, { backgroundColor: colors.progress }]} /> : undefined}
          onPress={() => navigation.navigate('AppleHealth')}
        />
        <ListRow colors={colors} icon={<Bell size={17} color={colors.mutedStrong} />} title="Reminders" subtitle="Workout, meal & weigh-in nudges"
          onPress={() => navigation.navigate('NotificationSettings')} />
        <ListRow
          colors={colors} icon={<Flame size={17} color={colors.signal} />} title="12-week challenge"
          subtitle={challenge?.isActive ? `Week ${challenge.currentWeek}` : 'Not started'}
          onPress={() => navigation.navigate('TransformationChallenge')}
        />
        <ListRow colors={colors} icon={<Download size={17} color={colors.mutedStrong} />} title="Export my data" isLast
          onPress={() => navigation.navigate('ExportData')} />
      </ListGroup>

      <View style={styles.sectionHeaderRow}><SectionLabel colors={colors}>About</SectionLabel></View>
      <ListGroup colors={colors} style={styles.groupMargin}>
        <ListRow colors={colors} title="Privacy policy" chevron={false}
          right={<ExternalLink size={15} color={colors.mutedStrong} />}
          onPress={() => Linking.openURL('https://your-app.vercel.app/privacy-policy.html')} />
        <ListRow colors={colors} title="Terms of service" chevron={false}
          right={<ExternalLink size={15} color={colors.mutedStrong} />}
          onPress={() => Linking.openURL('https://your-app.vercel.app/terms-of-service.html')} />
        <ListRow colors={colors} title="Contact support" chevron={false} isLast
          right={<ExternalLink size={15} color={colors.mutedStrong} />}
          onPress={() => Linking.openURL('mailto:support@fittrackpro.app')} />
      </ListGroup>

      <TouchableOpacity onPress={handleLogout} style={[styles.signOutBtn, { backgroundColor: colors.surface }]} activeOpacity={0.7}>
        <LogOut size={16} color={colors.danger} />
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: colors.danger }}>Sign out</Text>
      </TouchableOpacity>

      <Text style={{ fontFamily: Fonts.sans, fontSize: 10.5, color: colors.mutedForeground, textAlign: 'center', marginTop: 18 }}>
        FitTrack Pro {Constants.expoConfig?.version ?? '1.0.0'} (build {Constants.expoConfig?.ios?.buildNumber ?? '1'})
      </Text>
    </ScrollView>
  );
}

function Pill({ colors, label, progress }: { colors: any; label: string; progress?: boolean }) {
  return (
    <View style={[styles.pill, { backgroundColor: progress ? 'rgba(201,232,74,0.13)' : colors.surfaceInset }]}>
      <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 11, color: progress ? colors.progress : colors.mutedStrong }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 62, paddingHorizontal: 24 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  editBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  planCard: { marginHorizontal: 16, marginTop: 24, borderRadius: 18, padding: 19 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  pill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99 },
  sectionHeaderRow: { paddingHorizontal: 24, marginTop: 26, marginBottom: 12 },
  groupMargin: { marginHorizontal: 16 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 20, borderRadius: 14, paddingVertical: 15 },
});
