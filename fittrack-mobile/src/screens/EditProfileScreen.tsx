import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { AppliedBanner } from '../components/ui';
import * as api from '../services/api';
import type { UserProfile } from '@fittrack/core';

// Trimmed down to just the name field — everything else the old single-form
// profile screen used to own now lives in its own drill-in (Measurements,
// Goal & pace, Split & schedule, Coach mode, Units), reached from the Profile
// screen's grouped rows instead of one long form with a Save button.
export function EditProfileScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState('');
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    api.getUserProfile().then((p) => {
      if (p) {
        setProfile(p);
        setName(p.name);
      }
      setLoading(false);
    });
  }, []);

  const commit = useCallback(async () => {
    if (!profile || !name.trim() || name === profile.name) return;
    const next = { ...profile, name: name.trim() };
    setProfile(next);
    setApplied(false);
    try {
      await api.saveUserProfile({ ...next, id: profile.id });
      setApplied(true);
    } catch {
      setProfile(profile);
    }
  }, [profile, name]);

  if (loading || !profile) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.signal} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.circleBtn, { backgroundColor: colors.surface }]}>
          <ChevronLeft size={19} color={colors.ink} />
        </TouchableOpacity>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink, flex: 1, marginLeft: 12 }}>Edit name</Text>
      </View>

      <View style={{ padding: 16, gap: 14 }}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 10.5, letterSpacing: 0.5, color: colors.mutedForeground, textTransform: 'uppercase', marginBottom: 8 }}>Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceInset, color: colors.ink }]}
            value={name}
            onChangeText={setName}
            onBlur={commit}
            onSubmitEditing={commit}
            placeholder="Your name"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>
        <View style={styles.appliedRow}><AppliedBanner visible={applied} colors={colors} /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 4, gap: 10 },
  circleBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 16, padding: 16 },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: Fonts.sans, fontSize: 14 },
  appliedRow: { height: 20, justifyContent: 'center' },
});
