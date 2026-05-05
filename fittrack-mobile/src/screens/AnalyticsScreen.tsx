import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, StyleSheet,
} from 'react-native';
import { Scale, Dumbbell, TrendingUp, TrendingDown, Minus, Footprints } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import * as api from '../services/api';
import { analyzeActivity } from '@fittrack/core/src/algorithms/activity-analyzer';
import { HealthKitSync } from '../components/HealthKitSync';
import type { WeightEntry, DailyActivity, WorkoutSession } from '@fittrack/core';

function toDateString(d?: Date): string {
  const dt = d ?? new Date();
  return dt.toISOString().split('T')[0];
}

type TabId = 'overview' | 'strength' | 'activity';

export function AnalyticsScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [avgSteps, setAvgSteps] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [w, a, s] = await Promise.all([
        api.getWeightEntries(90),
        api.getDailyActivities(30),
        api.getRecentWorkouts(50),
      ]);
      setWeights(w);
      setWorkouts(s);
      setActivities(a);
      const insight = analyzeActivity(a);
      setAvgSteps(insight.averageSteps);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleAddWeight = async () => {
    const value = parseFloat(newWeight);
    if (isNaN(value) || value <= 0) return;
    await api.addWeightEntry({ date: toDateString(), weightLbs: value });
    setNewWeight('');
    setShowWeightInput(false);
    loadData();
  };

  const completedWorkouts = workouts.filter((w) => w.completed);
  const thisWeekWorkouts = completedWorkouts.filter((w) => {
    const d = new Date(w.date);
    return d >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  });

  const sortedWeights = [...weights].sort((a, b) => b.date.localeCompare(a.date));
  const latestWeight = sortedWeights.length > 0 ? sortedWeights[0].weightLbs : null;

  // Weight trend (last 7 entries)
  const weightTrend = sortedWeights.length >= 2
    ? sortedWeights[0].weightLbs - sortedWeights[Math.min(6, sortedWeights.length - 1)].weightLbs
    : 0;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'strength', label: 'Strength' },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.content}>
        {/* Log Weight Button */}
        <TouchableOpacity
          style={[styles.logWeightBtn, { backgroundColor: colors.primary + '15' }]}
          onPress={() => setShowWeightInput(!showWeightInput)}
          activeOpacity={0.7}
        >
          <Scale size={16} color={colors.primary} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary, marginLeft: 6 }}>Log Weight</Text>
        </TouchableOpacity>

        {/* Weight Input */}
        {showWeightInput && (
          <View style={[styles.weightInputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              style={[styles.weightInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              value={newWeight}
              onChangeText={setNewWeight}
              placeholder="Weight in lbs"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              onPress={handleAddWeight}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primaryForeground }}>Save</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Scale size={18} color={colors.primary} />
            <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 6 }}>Weight</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground, marginTop: 2 }}>
              {latestWeight ? `${latestWeight} lbs` : '--'}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Dumbbell size={18} color={colors.primary} />
            <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 6 }}>This Week</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground, marginTop: 2 }}>
              {thisWeekWorkouts.length}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {weightTrend < 0 ? <TrendingDown size={18} color={colors.success} /> :
             weightTrend > 0 ? <TrendingUp size={18} color={colors.warning} /> :
             <Minus size={18} color={colors.mutedForeground} />}
            <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 6 }}>Trend</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground, marginTop: 2 }}>
              {weightTrend !== 0 ? `${weightTrend > 0 ? '+' : ''}${weightTrend.toFixed(1)}` : '--'}
            </Text>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.tabBtn, activeTab === t.id && { backgroundColor: colors.card }]}
              onPress={() => setActiveTab(t.id)}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: activeTab === t.id ? colors.foreground : colors.mutedForeground }}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <View>
            {/* Weight History */}
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Weight History</Text>
            {sortedWeights.length > 0 ? (
              <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {sortedWeights.slice(0, 10).map((w, i) => (
                  <View key={i} style={[styles.historyRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                      {new Date(w.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>{w.weightLbs} lbs</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Scale size={36} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, marginTop: 8, fontSize: 13 }}>No weight entries yet</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'strength' && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Recent Workouts</Text>
            {completedWorkouts.length > 0 ? (
              <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {completedWorkouts.slice(0, 10).map((w, i) => (
                  <View key={i} style={[styles.historyRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>{w.name}</Text>
                      <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1 }}>
                        {new Date(w.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' · '}{w.exercises.length} exercises
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>
                      {w.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.actualWeight ?? s.targetWeight) * (s.actualReps ?? s.targetReps), 0), 0).toLocaleString()} lbs
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Dumbbell size={36} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, marginTop: 8, fontSize: 13 }}>Complete workouts to see strength data</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'activity' && (
          <View style={{ gap: 16 }}>
            {/* HealthKit Sync */}
            <HealthKitSync onSyncComplete={loadData} />

            {/* Average Steps Card */}
            <View style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Footprints size={18} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>Average Daily Steps</Text>
              </View>
              <Text style={{ fontSize: 28, fontWeight: '700', color: colors.foreground }}>
                {avgSteps > 0 ? `${(avgSteps / 1000).toFixed(1)}k` : '--'}
              </Text>
              <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 4 }}>
                {avgSteps > 0
                  ? avgSteps >= 10000 ? 'Great job! You\'re hitting your step goal.' : 'Try to reach 10,000 steps daily.'
                  : 'Enable Apple Health above to auto-track steps.'}
              </Text>
            </View>

            {/* Recent Activity Log */}
            {activities.length > 0 && (
              <View>
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Recent Activity</Text>
                <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {[...activities].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7).map((a, i) => (
                    <View key={i} style={[styles.historyRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                      <View>
                        <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                          {new Date(a.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </Text>
                        {a.source !== 'manual' && (
                          <Text style={{ fontSize: 10, color: colors.primary, marginTop: 1 }}>{a.source}</Text>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
                          {a.steps.toLocaleString()} steps
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                          {a.activeCalories} cal{a.restingHeartRate ? ` · ${a.restingHeartRate} bpm` : ''}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 16 },
  logWeightBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  weightInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  weightInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  saveBtn: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  tabRow: { flexDirection: 'row', borderRadius: 8, padding: 2 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  sectionTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  historyCard: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  activityCard: { borderWidth: 1, borderRadius: 12, padding: 20 },
});
