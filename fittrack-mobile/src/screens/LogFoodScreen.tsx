import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  Image, ActivityIndicator, StyleSheet, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { X, Camera, Image as ImageIcon, Search, Plus, ScanBarcode, MessageSquareText } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { SectionLabel, PillButton } from '../components/ui';
import * as api from '../services/api';
import { foods as COMMON_FOODS } from '@fittrack/core/src/data/foods';
import type { FoodItem, MealType } from '@fittrack/core';

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function defaultMeal(): MealType {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

function toDateString(d?: Date): string {
  return (d ?? new Date()).toISOString().split('T')[0];
}

function label(m: MealType) { return m.charAt(0).toUpperCase() + m.slice(1); }

export function LogFoodScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [meal, setMeal] = useState<MealType>(defaultMeal());
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([]);
  const [loadingRecents, setLoadingRecents] = useState(true);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');

  const [describeMode, setDescribeMode] = useState(false);
  const [describeText, setDescribeText] = useState('');
  const [describing, setDescribing] = useState(false);
  const [describeError, setDescribeError] = useState('');

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [results, setResults] = useState<FoodItem[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLoadingRecents(true);
    api.getRecentFoods(meal, 6).then(setRecentFoods).finally(() => setLoadingRecents(false));
  }, [meal]);

  useEffect(() => {
    if (!searchOpen) return;
    const q = query.toLowerCase().trim();
    if (q.length === 0) {
      setResults(recentFoods.length ? recentFoods : COMMON_FOODS.slice(0, 12));
      return;
    }
    setResults(COMMON_FOODS.filter((f: FoodItem) => f.name.toLowerCase().includes(q)).slice(0, 20));
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (q.length >= 2) {
        const usda = await api.searchUSDAFoods(q);
        setResults((prev) => [...prev, ...usda].slice(0, 30));
      }
    }, 400);
  }, [query, searchOpen, recentFoods]);

  const resetPhoto = useCallback(() => {
    setPhotoUri(null);
    setPhotoBase64(null);
    setDescription('');
    setAnalyzeError('');
  }, []);

  const closeDescribe = useCallback(() => {
    setDescribeMode(false);
    setDescribeText('');
    setDescribeError('');
  }, []);

  const processPickedImage = useCallback(async (uri: string) => {
    const image = await ImageManipulator.manipulate(uri).resize({ width: 1024 }).renderAsync();
    const result = await image.saveAsync({ base64: true, compress: 0.82, format: SaveFormat.JPEG });
    setPhotoUri(result.uri);
    setPhotoBase64(result.base64 ?? null);
  }, []);

  const takePhoto = useCallback(async () => {
    setAnalyzeError('');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setAnalyzeError('Camera permission is required to take a photo.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.9 });
    if (!result.canceled && result.assets[0]) await processPickedImage(result.assets[0].uri);
  }, [processPickedImage]);

  const pickFromLibrary = useCallback(async () => {
    setAnalyzeError('');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setAnalyzeError('Photo library permission is required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.9 });
    if (!result.canceled && result.assets[0]) await processPickedImage(result.assets[0].uri);
  }, [processPickedImage]);

  const analyzePhoto = useCallback(async () => {
    if (!photoBase64 || !photoUri) return;
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      const data = await api.analyzeFoodPhoto(photoBase64, 'image/jpeg', description.trim() || undefined);
      navigation.navigate('AIFoodReview', {
        photoUri,
        meal,
        date: toDateString(),
        items: data.items,
        notes: data.notes ?? null,
      });
      resetPhoto();
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : 'Could not analyze this photo. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }, [photoBase64, photoUri, description, meal, navigation, resetPhoto]);

  const analyzeDescription = useCallback(async () => {
    const trimmed = describeText.trim();
    if (!trimmed) return;
    setDescribing(true);
    setDescribeError('');
    try {
      const data = await api.analyzeFoodText(trimmed);
      navigation.navigate('AIFoodReview', {
        photoUri: null,
        meal,
        date: toDateString(),
        items: data.items,
        notes: data.notes ?? null,
      });
      closeDescribe();
    } catch (e) {
      setDescribeError(e instanceof Error ? e.message : 'Could not analyze that description. Please try again.');
    } finally {
      setDescribing(false);
    }
  }, [describeText, meal, navigation, closeDescribe]);

  const logFoodItem = useCallback(async (food: FoodItem) => {
    const factor = food.servingSizeG / 100;
    await api.addFoodLogEntry({
      date: toDateString(),
      foodItemId: food.id,
      foodName: food.name,
      servings: 1,
      servingSizeG: food.servingSizeG,
      meal,
      calories: food.caloriesPer100g * factor,
      protein: food.proteinPer100g * factor,
      carbs: food.carbsPer100g * factor,
      fat: food.fatPer100g * factor,
    });
    navigation.goBack();
  }, [meal, navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.iconBtn, { backgroundColor: colors.surfaceInset }]}>
          <X size={18} color={colors.ink} />
        </TouchableOpacity>
        <View style={[styles.mealPills, { backgroundColor: colors.surfaceInset }]}>
          {MEALS.map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setMeal(m)}
              style={[styles.mealPill, meal === m && { backgroundColor: colors.ink }]}
            >
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 11, color: meal === m ? colors.canvas : colors.mutedStrong }}>
                {label(m)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ width: 34 }} />
      </View>

      {photoUri ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <Image source={{ uri: photoUri }} style={{ width: '100%', height: 240, borderRadius: 18 }} resizeMode="cover" />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder='Optional: add context (e.g. "grilled, no oil")'
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[styles.descInput, { backgroundColor: colors.surface, color: colors.ink }]}
          />
          {!!analyzeError && <Text style={{ color: colors.danger, fontSize: 13 }}>{analyzeError}</Text>}
          <PillButton
            label={analyzing ? 'Analyzing…' : 'Analyze photo'}
            colors={colors}
            onPress={analyzePhoto}
            disabled={analyzing}
            icon={analyzing ? <ActivityIndicator color={colors.signalForeground} /> : undefined}
          />
          <PillButton label="Retake" colors={colors} tone="ghost" onPress={resetPhoto} disabled={analyzing} />
        </ScrollView>
      ) : describeMode ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <Text style={{ fontFamily: Fonts.sans, fontSize: 12.5, color: colors.mutedForeground }}>
            Tell me what you ate — I'll estimate the items and macros.
          </Text>
          <TextInput
            value={describeText}
            onChangeText={setDescribeText}
            placeholder='e.g. "2 eggs, a slice of toast with butter, and a black coffee"'
            placeholderTextColor={colors.mutedForeground}
            multiline
            autoFocus
            style={[styles.descInput, { backgroundColor: colors.surface, color: colors.ink, minHeight: 100 }]}
          />
          {!!describeError && <Text style={{ color: colors.danger, fontSize: 13 }}>{describeError}</Text>}
          <PillButton
            label={describing ? 'Analyzing…' : 'Analyze description'}
            colors={colors}
            onPress={analyzeDescription}
            disabled={describing || !describeText.trim()}
            icon={describing ? <ActivityIndicator color={colors.signalForeground} /> : undefined}
          />
          <PillButton label="Cancel" colors={colors} tone="ghost" onPress={closeDescribe} disabled={describing} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
            <TouchableOpacity
              onPress={takePhoto}
              activeOpacity={0.85}
              style={[styles.snapBtn, { backgroundColor: colors.signal }]}
            >
              <Camera size={22} color={colors.signalForeground} strokeWidth={2.2} />
              <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 16, color: colors.signalForeground }}>Snap a photo</Text>
            </TouchableOpacity>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: colors.mutedForeground, textAlign: 'center' }}>
              I'll name the food and estimate the macros — you can adjust anything after.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity onPress={pickFromLibrary} style={[styles.smallBtn, { backgroundColor: colors.surfaceInset }]} activeOpacity={0.7}>
                <ImageIcon size={16} color={colors.mutedStrong} />
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12.5, color: colors.mutedStrong }}>Library</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setDescribeMode(true)} style={[styles.smallBtn, { backgroundColor: colors.surfaceInset }]} activeOpacity={0.7}>
                <MessageSquareText size={16} color={colors.mutedStrong} />
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12.5, color: colors.mutedStrong }}>Describe it</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSearchOpen(true)} style={[styles.smallBtn, { backgroundColor: colors.surfaceInset }]} activeOpacity={0.7}>
                <ScanBarcode size={16} color={colors.mutedStrong} />
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12.5, color: colors.mutedStrong }}>Barcode / search</Text>
              </TouchableOpacity>
            </View>
            {!!analyzeError && <Text style={{ color: colors.danger, fontSize: 13, textAlign: 'center' }}>{analyzeError}</Text>}
          </View>

          <View style={styles.sectionHeaderRow}>
            <SectionLabel colors={colors}>Your usual {meal}</SectionLabel>
          </View>
          {loadingRecents ? (
            <ActivityIndicator color={colors.signal} style={{ marginTop: 16 }} />
          ) : recentFoods.length === 0 ? (
            <Text style={{ fontFamily: Fonts.sans, fontSize: 12.5, color: colors.mutedForeground, paddingHorizontal: 20 }}>
              Log a few meals and your usual foods will show up here for one-tap logging.
            </Text>
          ) : (
            <View style={styles.tileGrid}>
              {recentFoods.map((food) => (
                <TouchableOpacity
                  key={food.id}
                  style={[styles.tile, { backgroundColor: colors.surface }]}
                  activeOpacity={0.7}
                  onPress={() => logFoodItem(food)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.ink }} numberOfLines={1}>{food.name}</Text>
                    <Text style={{ fontFamily: Fonts.sans, fontSize: 11, color: colors.mutedForeground, marginTop: 3 }}>
                      {Math.round(food.caloriesPer100g * food.servingSizeG / 100)} kcal · {Math.round(food.proteinPer100g * food.servingSizeG / 100)}g P
                    </Text>
                  </View>
                  <View style={[styles.tileAdd, { backgroundColor: colors.surfaceInset }]}>
                    <Plus size={14} color={colors.progress} strokeWidth={2.6} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {searchOpen && (
            <View style={{ marginTop: 24 }}>
              <View style={styles.sectionHeaderRow}>
                <SectionLabel colors={colors}>Search foods</SectionLabel>
              </View>
              <View style={[styles.searchRow, { backgroundColor: colors.surfaceInset, marginHorizontal: 16 }]}>
                <Search size={16} color={colors.mutedForeground} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                  placeholder='Or type it — "200g chicken, 1 cup rice"'
                  placeholderTextColor={colors.mutedForeground}
                  style={{ flex: 1, fontFamily: Fonts.sans, fontSize: 14, color: colors.ink, paddingVertical: 4 }}
                />
              </View>
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingHorizontal: 16, marginTop: 8 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.resultRow, { borderTopColor: colors.hairline }]}
                    onPress={() => logFoodItem(item)}
                    activeOpacity={0.6}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 14, color: colors.ink }}>{item.name}</Text>
                      <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, color: colors.mutedForeground, marginTop: 2 }}>
                        {item.servingSizeG}g · {Math.round(item.caloriesPer100g * item.servingSizeG / 100)} cal
                      </Text>
                    </View>
                    <Plus size={16} color={colors.progress} />
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  mealPills: { flex: 1, flexDirection: 'row', borderRadius: 10, padding: 3, gap: 2 },
  mealPill: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  snapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, paddingVertical: 18 },
  smallBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 12 },
  descInput: { borderRadius: 10, padding: 12, fontSize: 13, fontFamily: Fonts.sans, minHeight: 48 },
  sectionHeaderRow: { paddingHorizontal: 20, marginTop: 26, marginBottom: 12 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  tile: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 13 },
  tileAdd: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1 },
});
