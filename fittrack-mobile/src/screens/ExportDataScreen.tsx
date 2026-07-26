import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Check, Share as ShareIcon } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import * as api from '../services/api';
import type { ExportSection } from '../services/api';

const SECTIONS: { value: ExportSection; label: string }[] = [
  { value: 'meals', label: 'Meals & macros' },
  { value: 'workouts', label: 'Workouts & sets' },
  { value: 'weighins', label: 'Weigh-ins' },
];

export function ExportDataScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [sections, setSections] = useState<Set<ExportSection>>(new Set(['meals', 'workouts', 'weighins']));
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [range, setRange] = useState<'90' | 'all'>('90');
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const toggleSection = (s: ExportSection) => {
    const next = new Set(sections);
    if (next.has(s)) next.delete(s); else next.add(s);
    setSections(next);
  };

  const runExport = async () => {
    if (sections.size === 0) return;
    setExporting(true);
    try {
      const { content, filename, mimeType } = await api.exportData({
        format, range, sections: [...sections],
      });
      const fileUri = (FileSystem.documentDirectory ?? '') + filename;
      await FileSystem.writeAsStringAsync(fileUri, content);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType, dialogTitle: filename });
      }
      setLastExport(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.circleBtn, { backgroundColor: colors.surface }]}>
          <ChevronLeft size={19} color={colors.ink} />
        </TouchableOpacity>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink, flex: 1, marginLeft: 12 }}>Export my data</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <View>
          <Text style={{ fontFamily: Fonts.serif, fontSize: 22, lineHeight: 27, color: colors.ink }}>Everything you've logged, yours to take</Text>
          <Text style={{ fontFamily: Fonts.sans, fontSize: 12.5, lineHeight: 18, color: colors.mutedForeground, marginTop: 8 }}>
            One file, sent to whatever you share it with. Nothing is deleted from the app.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {SECTIONS.map((s, i) => {
            const checked = sections.has(s.value);
            return (
              <TouchableOpacity
                key={s.value}
                onPress={() => toggleSection(s.value)}
                style={[styles.sectionRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.hairline }]}
              >
                <View style={[styles.checkbox, { backgroundColor: checked ? colors.progress : 'transparent', borderColor: checked ? colors.progress : colors.hairline }]}>
                  {checked && <Check size={12} color={colors.canvas} strokeWidth={3} />}
                </View>
                <Text style={{ flex: 1, fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.ink }}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.formatGrid}>
          <TouchableOpacity
            onPress={() => setFormat('csv')}
            style={[styles.formatCard, { backgroundColor: format === 'csv' ? 'rgba(201,232,74,.1)' : colors.surface, borderColor: format === 'csv' ? colors.progress : colors.hairline }]}
          >
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: format === 'csv' ? colors.progress : colors.ink }}>CSV</Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 11, lineHeight: 16, color: colors.mutedForeground, marginTop: 4 }}>One sheet per section. Opens in anything.</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFormat('json')}
            style={[styles.formatCard, { backgroundColor: format === 'json' ? 'rgba(201,232,74,.1)' : colors.surface, borderColor: format === 'json' ? colors.progress : colors.hairline }]}
          >
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: format === 'json' ? colors.progress : colors.ink }}>JSON</Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 11, lineHeight: 16, color: colors.mutedForeground, marginTop: 4 }}>Full fidelity, for another app.</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.rangeRow, { backgroundColor: colors.surface }]}>
          <Text style={{ flex: 1, fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.ink }}>Range</Text>
          <View style={[styles.rangeTrack, { backgroundColor: colors.surfaceInset }]}>
            {(['90', 'all'] as const).map((r) => (
              <TouchableOpacity key={r} onPress={() => setRange(r)} style={[styles.rangeSeg, range === r && { backgroundColor: colors.ink }]}>
                <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 11.5, color: range === r ? colors.canvas : colors.mutedForeground }}>
                  {r === '90' ? '90 days' : 'All time'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          onPress={runExport}
          disabled={exporting || sections.size === 0}
          style={[styles.exportBtn, { backgroundColor: colors.ink, opacity: exporting || sections.size === 0 ? 0.5 : 1 }]}
        >
          {exporting ? <ActivityIndicator color={colors.canvas} /> : <ShareIcon size={16} color={colors.canvas} strokeWidth={2.3} />}
          <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.canvas }}>
            {exporting ? 'Preparing…' : `Export ${sections.size} section${sections.size === 1 ? '' : 's'}`}
          </Text>
        </TouchableOpacity>

        {lastExport && (
          <View style={[styles.lastExportRow, { backgroundColor: colors.surface }]}>
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: colors.ink }}>Last export</Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>{lastExport}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 4, gap: 10 },
  circleBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 18, overflow: 'hidden' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15 },
  checkbox: { width: 19, height: 19, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  formatGrid: { flexDirection: 'row', gap: 10 },
  formatCard: { flex: 1, borderWidth: 1.5, borderRadius: 15, padding: 14 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 15, padding: 15 },
  rangeTrack: { flexDirection: 'row', gap: 4, borderRadius: 11, padding: 3 },
  rangeSeg: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 11 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 15, paddingVertical: 16 },
  lastExportRow: { borderRadius: 14, padding: 14 },
});
