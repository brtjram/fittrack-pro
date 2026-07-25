import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Shield, FlaskConical, Leaf } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import * as api from '../services/api';
import { getSupplementsByGoal, getCoreSupplements } from '@fittrack/core/src/data/supplements';
import type { Supplement, Goal } from '@fittrack/core';

const categories: { key: Supplement['category']; label: string }[] = [
  { key: 'core', label: 'Essential (Start Here)' },
  { key: 'fat_loss', label: 'Fat Loss Support' },
  { key: 'recovery', label: 'Recovery' },
  { key: 'health', label: 'General Health' },
];

const categoryIcons: Record<Supplement['category'], typeof Shield> = {
  core: Shield,
  fat_loss: FlaskConical,
  recovery: Leaf,
  health: Shield,
};

export function SupplementsScreen() {
  const { colors } = useTheme();
  const [goal, setGoal] = useState<Goal>('fat_loss');
  const [recommended, setRecommended] = useState<Supplement[]>([]);

  useEffect(() => {
    api.getUserProfile().then((profile) => {
      if (profile) setGoal(profile.goal);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const core = getCoreSupplements();
    const goalSpecific = getSupplementsByGoal(goal).filter((s) => s.category !== 'core');
    setRecommended([...core, ...goalSpecific]);
  }, [goal]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.content}>
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recommended for Your Goal</Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 4, lineHeight: 18 }}>
            Based on your <Text style={{ color: colors.primary, fontWeight: '600' }}>{goal.replace('_', ' ')}</Text> goal.
            These are evidence-based supplements that may support your progress.
          </Text>
        </View>

        {categories.map((cat) => {
          const catSupps = recommended.filter((s) => s.category === cat.key);
          if (catSupps.length === 0) return null;
          return (
            <View key={cat.key} style={{ gap: 10 }}>
              <Text style={[styles.categoryLabel, { color: colors.mutedForeground }]}>{cat.label}</Text>
              {catSupps.map((supp) => {
                const Icon = categoryIcons[supp.category] ?? Shield;
                return (
                  <View key={supp.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <View style={[styles.iconWrap, { backgroundColor: colors.primary + '18' }]}>
                        <Icon size={18} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.foreground }}>{supp.name}</Text>
                          <View style={[styles.evidenceBadge, { backgroundColor: evidenceColor(supp.evidenceLevel, colors) + '18' }]}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: evidenceColor(supp.evidenceLevel, colors) }}>
                              {supp.evidenceLevel}
                            </Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary, marginTop: 4 }}>{supp.dosage}</Text>
                        <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>{supp.timing}</Text>
                      </View>
                    </View>

                    <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {supp.benefits.map((benefit, i) => (
                        <View key={i} style={[styles.benefitPill, { backgroundColor: colors.muted }]}>
                          <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{benefit}</Text>
                        </View>
                      ))}
                    </View>

                    {supp.notes && (
                      <Text style={{ fontSize: 11, color: colors.mutedForeground, fontStyle: 'italic', marginTop: 8 }}>
                        {supp.notes}
                      </Text>
                    )}

                    {supp.contraindications && supp.contraindications.length > 0 && (
                      <View style={[styles.warnBox, { backgroundColor: colors.destructive + '0D' }]}>
                        <Text style={{ fontSize: 11, color: colors.destructive }}>
                          <Text style={{ fontWeight: '700' }}>Note: </Text>
                          {supp.contraindications.join('. ')}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}

        <View style={[styles.disclaimer, { backgroundColor: colors.muted }]}>
          <Text style={{ fontSize: 11, color: colors.mutedForeground, textAlign: 'center', lineHeight: 16 }}>
            Supplements are not a substitute for a balanced diet. Consult with a healthcare provider before starting any supplement regimen.
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </View>
    </ScrollView>
  );
}

function evidenceColor(level: Supplement['evidenceLevel'], colors: ReturnType<typeof useTheme>['colors']): string {
  if (level === 'strong') return colors.success;
  if (level === 'moderate') return colors.warning;
  return colors.primary;
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  section: { borderWidth: 1, borderRadius: 14, padding: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  categoryLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  iconWrap: { borderRadius: 10, padding: 8 },
  evidenceBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  benefitPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  warnBox: { borderRadius: 10, padding: 8, marginTop: 8 },
  disclaimer: { borderRadius: 12, padding: 14 },
});
