import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Sparkles, SlidersHorizontal, Check, Utensils, Dumbbell, Repeat, Shield, MessageCircle } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { AppliedBanner } from '../components/ui';
import * as api from '../services/api';
import type { UserProfile } from '@fittrack/core';
import { calculateMacroTargets } from '@fittrack/core';

const CONTROLS = [
  { icon: Utensils, title: 'Calories & macros' },
  { icon: Dumbbell, title: 'Split, sets & loads' },
  { icon: Repeat, title: 'Weekly adjustments' },
  { icon: Shield, title: 'Ask before big changes' },
];

export function CoachModeScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [goalDraft, setGoalDraft] = useState('');
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    api.getUserProfile().then((p) => {
      setProfile(p ?? null);
      setGoalDraft(p?.aiCoachGoal ?? '');
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

  const isCoached = profile.goal === 'ai_coach';
  const isChallenge = profile.goal === 'challenge';
  const macros = !isCoached && !isChallenge ? calculateMacroTargets(profile) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.circleBtn, { backgroundColor: colors.surface }]}>
          <ChevronLeft size={19} color={colors.ink} />
        </TouchableOpacity>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink, flex: 1, marginLeft: 12 }}>Coach mode</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <Text style={{ fontFamily: Fonts.serif, fontSize: 24, lineHeight: 28, color: colors.ink }}>Who decides your numbers?</Text>

        {isChallenge ? (
          <View style={[styles.card, { backgroundColor: colors.surface, padding: 19 }]}>
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink }}>Your 12-week challenge is active</Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 12.5, lineHeight: 19, color: colors.mutedForeground, marginTop: 8 }}>
              The challenge's current phase sets your targets and training instead. Leave the challenge from its own screen to choose AI coach or manual mode here.
            </Text>
          </View>
        ) : (
          <>
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={() => commit({ goal: 'ai_coach' })}
                style={[styles.optionCard, { backgroundColor: isCoached ? 'rgba(201,232,74,.09)' : colors.surface, borderColor: isCoached ? colors.progress : colors.hairline }]}
              >
                <View style={styles.optionHeader}>
                  <Sparkles size={19} color={isCoached ? colors.progress : colors.mutedForeground} />
                  <Text style={{ flex: 1, fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink }}>AI coach</Text>
                  <View style={[styles.radio, { borderColor: isCoached ? colors.progress : colors.faint, backgroundColor: isCoached ? colors.progress : 'transparent' }]}>
                    {isCoached && <Check size={12} color={colors.canvas} strokeWidth={3} />}
                  </View>
                </View>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, lineHeight: 18, color: colors.mutedForeground, marginTop: 10 }}>
                  You describe the goal in your own words. The coach writes the targets and the split, then adjusts them as you report progress, your logs, and your session data.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => commit({ goal: 'maintain' })}
                style={[styles.optionCard, { backgroundColor: !isCoached ? 'rgba(201,232,74,.09)' : colors.surface, borderColor: !isCoached ? colors.progress : colors.hairline }]}
              >
                <View style={styles.optionHeader}>
                  <SlidersHorizontal size={19} color={!isCoached ? colors.progress : colors.mutedForeground} />
                  <Text style={{ flex: 1, fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink }}>I set it myself</Text>
                  <View style={[styles.radio, { borderColor: !isCoached ? colors.progress : colors.faint, backgroundColor: !isCoached ? colors.progress : 'transparent' }]}>
                    {!isCoached && <Check size={12} color={colors.canvas} strokeWidth={3} />}
                  </View>
                </View>
                <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, lineHeight: 18, color: colors.mutedForeground, marginTop: 10 }}>
                  Calories, protein, split and schedule stay exactly where you put them in Goal & pace and Split & schedule. The coach only answers questions.
                </Text>
              </TouchableOpacity>
            </View>

            {isCoached && !profile.aiCoachGoal && (
              <View style={[styles.card, { backgroundColor: colors.surface, padding: 18 }]}>
                <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.ink }}>What are you training for?</Text>
                <TextInput
                  value={goalDraft}
                  onChangeText={setGoalDraft}
                  onBlur={() => goalDraft.trim() && commit({ aiCoachGoal: goalDraft.trim() })}
                  placeholder='e.g. "Marathon in 16 weeks while keeping my muscle"'
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  style={[styles.goalInput, { backgroundColor: colors.surfaceInset, color: colors.ink }]}
                />
                <Text style={{ fontFamily: Fonts.sans, fontSize: 11, lineHeight: 16, color: colors.mutedForeground, marginTop: 8 }}>
                  Save this, then open coach chat — it'll turn this into real daily targets and a weekly plan.
                </Text>
              </View>
            )}

            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, letterSpacing: 1, color: colors.mutedForeground, textTransform: 'uppercase', marginTop: 4 }}>
              What the coach controls
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface, opacity: isCoached ? 1 : 0.45 }]}>
              {CONTROLS.map((c, i) => {
                const Icon = c.icon;
                return (
                  <View key={c.title} style={[styles.controlRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.hairline }]}>
                    <Icon size={16} color={isCoached ? colors.progress : colors.mutedForeground} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.ink }}>{c.title}</Text>
                      {c.title === 'Calories & macros' && macros === null && isCoached && (
                        <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>Set by the coach in chat</Text>
                      )}
                    </View>
                    <View style={[styles.toggleTrack, { backgroundColor: isCoached ? 'rgba(201,232,74,.4)' : colors.surfaceInset }]}>
                      <View style={[styles.toggleThumb, { backgroundColor: isCoached ? colors.progress : colors.faint, alignSelf: isCoached ? 'flex-end' : 'flex-start' }]} />
                    </View>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => navigation.getParent()?.navigate('MainTabs', { screen: 'Coach' })}
              style={[styles.chatBtn, { backgroundColor: colors.progress }]}
            >
              <MessageCircle size={17} color={colors.canvas} strokeWidth={2.3} />
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.canvas }}>Open coach chat</Text>
            </TouchableOpacity>

            <View style={styles.appliedRow}><AppliedBanner visible={applied} colors={colors} /></View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 4, gap: 10 },
  circleBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 18, overflow: 'hidden' },
  optionCard: { borderWidth: 1.5, borderRadius: 18, padding: 18 },
  optionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: { width: 20, height: 20, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  goalInput: { borderRadius: 10, padding: 12, marginTop: 10, minHeight: 70, fontFamily: Fonts.sans, fontSize: 14, textAlignVertical: 'top' },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 15 },
  toggleTrack: { width: 44, height: 27, borderRadius: 14, padding: 2 },
  toggleThumb: { width: 23, height: 23, borderRadius: 12 },
  chatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 15, paddingVertical: 16 },
  appliedRow: { height: 20, justifyContent: 'center' },
});
