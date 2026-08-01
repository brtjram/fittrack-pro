import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { ChevronLeft, Camera, Check } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import * as api from '../services/api';
import type { ProgressPhoto, ProgressPhotoAngle } from '../services/api';

function toDateString(d?: Date): string {
  const dt = d ?? new Date();
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Prescriptive, not free-form — the same three angles every time is what
// makes a photo comparison months apart actually mean something, rather
// than three random snapshots that don't line up.
const ANGLES: { id: ProgressPhotoAngle; label: string; instruction: string }[] = [
  { id: 'front', label: 'Front', instruction: 'Face the camera directly, arms relaxed at your sides' },
  { id: 'side', label: 'Side', instruction: 'Turn 90° — right side facing the camera' },
  { id: 'back', label: 'Back', instruction: 'Turn around, back facing the camera' },
];

type ImgSource = { uri: string; headers: Record<string, string> };

export function ProgressPhotoScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const date = toDateString();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Partial<Record<ProgressPhotoAngle, ProgressPhoto>>>({});
  const [sources, setSources] = useState<Record<string, ImgSource>>({});
  const [capturingAngle, setCapturingAngle] = useState<ProgressPhotoAngle | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const list = await api.getProgressPhotos(date);
      const byAngle: Partial<Record<ProgressPhotoAngle, ProgressPhoto>> = {};
      for (const p of list) byAngle[p.angle] = p;
      setPhotos(byAngle);
      const entries = await Promise.all(list.map(async (p) => [p.id, await api.getProgressPhotoImageSource(p.id)] as const));
      setSources(Object.fromEntries(entries));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load progress photos.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const capture = useCallback(async (angle: ProgressPhotoAngle) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Enable camera access in Settings → FitTrack Pro to take progress photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;

    setCapturingAngle(angle);
    try {
      const image = await ImageManipulator.manipulate(result.assets[0].uri).resize({ width: 1024 }).renderAsync();
      const saved = await image.saveAsync({ base64: true, compress: 0.85, format: SaveFormat.JPEG });
      if (!saved.base64) throw new Error('Could not process that photo.');
      await api.uploadProgressPhoto(date, angle, saved.base64, 'image/jpeg');
      await load();
    } catch (e) {
      Alert.alert('Could not save photo', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setCapturingAngle(null);
    }
  }, [date, load]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator size="large" color={colors.signal} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.canvas, gap: 14, padding: 30 }]}>
        <Text style={{ fontFamily: Fonts.sans, fontSize: 13, color: colors.mutedForeground, textAlign: 'center' }}>{loadError}</Text>
        <TouchableOpacity onPress={() => { setLoading(true); load(); }} style={[styles.captureBtn, { backgroundColor: colors.signal, paddingHorizontal: 20 }]}>
          <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: colors.signalForeground }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const doneCount = ANGLES.filter((a) => photos[a.id]).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.circleBtn, { backgroundColor: colors.surface }]}>
          <ChevronLeft size={19} color={colors.ink} />
        </TouchableOpacity>
        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink, flex: 1, marginLeft: 12 }}>
          Progress photos · {doneCount}/3
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <Text style={{ fontFamily: Fonts.serif, fontSize: 22, lineHeight: 27, color: colors.ink }}>
          Same three angles each time makes the comparison mean something
        </Text>

        {ANGLES.map((a) => {
          const photo = photos[a.id];
          const source = photo ? sources[photo.id] : null;
          const isCapturing = capturingAngle === a.id;
          return (
            <View key={a.id} style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={{ flexDirection: 'row', gap: 14 }}>
                <View style={[styles.thumb, { backgroundColor: colors.surfaceInset }]}>
                  {isCapturing ? (
                    <ActivityIndicator color={colors.signal} />
                  ) : source ? (
                    <Image source={source} style={styles.thumbImg} />
                  ) : (
                    <Camera size={20} color={colors.mutedForeground} />
                  )}
                </View>
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14.5, color: colors.ink }}>{a.label}</Text>
                    {photo && <Check size={13} color={colors.progress} strokeWidth={2.6} />}
                  </View>
                  <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, lineHeight: 16, color: colors.mutedForeground, marginTop: 3 }}>
                    {a.instruction}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                disabled={isCapturing}
                onPress={() => capture(a.id)}
                activeOpacity={0.8}
                style={[styles.captureBtn, { backgroundColor: photo ? colors.surfaceInset : colors.signal, opacity: isCapturing ? 0.6 : 1 }]}
              >
                <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 12.5, color: photo ? colors.ink : colors.signalForeground }}>
                  {photo ? 'Retake' : 'Capture'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {doneCount === ANGLES.length && (
          <View style={[styles.doneBanner, { backgroundColor: 'rgba(201,232,74,.1)' }]}>
            <Check size={15} color={colors.progress} />
            <Text style={{ fontFamily: Fonts.sans, fontSize: 12, lineHeight: 17, color: colors.mutedStrong, flex: 1 }}>
              All three angles saved for today.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8 },
  circleBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 18, padding: 16, gap: 14 },
  thumb: { width: 60, height: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: 60, height: 60, borderRadius: 14 },
  captureBtn: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 11 },
  doneBanner: { flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: 14, padding: 14 },
});
