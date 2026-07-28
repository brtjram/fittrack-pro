import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  Image, ActivityIndicator, StyleSheet, FlatList, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X, Camera, Image as ImageIcon, Search, Plus, ScanBarcode, Zap, ZapOff } from 'lucide-react-native';
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
  const dt = d ?? new Date();
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  const [barcodeMode, setBarcodeMode] = useState(false);
  const [lookingUpBarcode, setLookingUpBarcode] = useState(false);
  const [barcodeError, setBarcodeError] = useState('');
  const scanLockRef = useRef(false);

  // Live viewfinder (mockup "1d" — camera-first capture sheet).
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const cameraGranted = permission?.granted ?? false;

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

  // Ask for camera access as soon as the sheet opens so the viewfinder is
  // live by the time the user looks at the screen — mirrors the pattern in
  // AppleHealthScreen's requestHealthKitPermissions (ask once, handle denial
  // gracefully rather than blocking the rest of the screen).
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.status]);

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

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery('');
  }, []);

  const closeBarcode = useCallback(() => {
    setBarcodeMode(false);
    setBarcodeError('');
    scanLockRef.current = false;
  }, []);

  const processPickedImage = useCallback(async (uri: string) => {
    const image = await ImageManipulator.manipulate(uri).resize({ width: 1024 }).renderAsync();
    const result = await image.saveAsync({ base64: true, compress: 0.82, format: SaveFormat.JPEG });
    setPhotoUri(result.uri);
    setPhotoBase64(result.base64 ?? null);
  }, []);

  const capturePhoto = useCallback(async () => {
    setAnalyzeError('');
    if (!cameraGranted) {
      const res = await requestPermission();
      if (!res.granted) setAnalyzeError('Camera permission is required to take a photo.');
      return;
    }
    if (!cameraRef.current || !cameraReady || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) await processPickedImage(photo.uri);
    } catch {
      setAnalyzeError('Could not capture that photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  }, [cameraGranted, requestPermission, cameraReady, capturing, processPickedImage]);

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

  const handleBarcodeScanned = useCallback(async (result: { data: string }) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    setLookingUpBarcode(true);
    setBarcodeError('');
    try {
      const food = await api.getFoodByBarcode(result.data);
      if (food) {
        // Route through the same confirm/edit screen as photo and describe
        // instead of saving straight away — a barcode match is still just
        // one serving's worth of assumed values until the user confirms the
        // portion, and skipping review here was the one capture method that
        // silently saved and closed with no feedback.
        const factor = food.servingSizeG / 100;
        navigation.navigate('AIFoodReview', {
          photoUri: null,
          meal,
          date: toDateString(),
          items: [{
            name: food.name,
            servingDescription: food.servingLabel,
            servingSizeG: food.servingSizeG,
            calories: Math.round(food.caloriesPer100g * factor),
            protein: Math.round(food.proteinPer100g * factor * 10) / 10,
            carbs: Math.round(food.carbsPer100g * factor * 10) / 10,
            fat: Math.round(food.fatPer100g * factor * 10) / 10,
            confidence: 'high',
          }],
          notes: null,
        });
        closeBarcode();
        return;
      }
      setBarcodeError("Couldn't find that product. Try again or search by name.");
    } catch {
      setBarcodeError("Couldn't find that product. Try again or search by name.");
    } finally {
      setLookingUpBarcode(false);
      scanLockRef.current = false;
    }
  }, [meal, navigation, closeBarcode]);

  const showPlainHeader = !!photoUri || describeMode || searchOpen;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      {showPlainHeader && (
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
      )}

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
            placeholder='e.g. "200g chicken, 1 cup rice"'
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
      ) : searchOpen ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
          <View style={[styles.searchRow, { backgroundColor: colors.surfaceInset }]}>
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

          <View style={styles.sectionHeaderRow}>
            <SectionLabel colors={colors}>Your usual {meal}</SectionLabel>
          </View>
          {loadingRecents ? (
            <ActivityIndicator color={colors.signal} style={{ marginTop: 4 }} />
          ) : recentFoods.length === 0 ? (
            <Text style={{ fontFamily: Fonts.sans, fontSize: 12.5, color: colors.mutedForeground }}>
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

          <View style={styles.sectionHeaderRow}>
            <SectionLabel colors={colors}>Search foods</SectionLabel>
          </View>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
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

          <PillButton label="Back to camera" colors={colors} tone="ghost" onPress={closeSearch} />
        </ScrollView>
      ) : (
        // 1d — camera-first capture sheet. Live viewfinder is the primary
        // surface; typed description and search are reachable but secondary.
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: colors.canvas }}>
            {cameraGranted ? (
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                flash={flashOn ? 'on' : 'off'}
                onCameraReady={() => setCameraReady(true)}
                barcodeScannerSettings={barcodeMode ? { barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] } : undefined}
                onBarcodeScanned={barcodeMode ? handleBarcodeScanned : undefined}
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceInset }]} />
            )}

            <View style={[styles.cameraTopRow, { top: insets.top + 12 }]}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={[styles.overlayIconBtn, { backgroundColor: colors.surfaceInset + 'CC' }]}
              >
                <X size={18} color={colors.ink} />
              </TouchableOpacity>
              <View style={[styles.overlayMealPills, { backgroundColor: colors.surfaceInset + 'DB' }]}>
                {MEALS.map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setMeal(m)}
                    style={[styles.overlayMealPill, meal === m && { backgroundColor: colors.ink }]}
                  >
                    <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 11, color: meal === m ? colors.canvas : colors.mutedStrong }}>
                      {label(m)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                onPress={() => setFlashOn((v) => !v)}
                style={[styles.overlayIconBtn, { backgroundColor: colors.surfaceInset + 'CC' }]}
              >
                {flashOn ? <Zap size={16} color={colors.ink} /> : <ZapOff size={16} color={colors.ink} />}
              </TouchableOpacity>
            </View>

            {cameraGranted && (
              <View
                pointerEvents="none"
                style={[styles.viewfinderFrame, { top: insets.top + 74, borderColor: colors.ink + '2E' }]}
              />
            )}

            {/* Flat scrim behind the headline/actions for legibility over a
                bright live feed — a plain approximation of the mockup's
                gradient overlay since no gradient library is in this project. */}
            <View pointerEvents="none" style={[styles.cameraBottomScrim, { backgroundColor: colors.canvas + '99' }]} />

            <View style={styles.cameraBottomBlock}>
              {cameraGranted ? (
                barcodeMode ? (
                  <>
                    <Text style={[styles.cameraHeadline, { fontFamily: Fonts.serif, color: colors.ink }]}>
                      Scan a barcode
                    </Text>
                    <Text style={[styles.cameraSubtitle, { fontFamily: Fonts.sans, color: colors.mutedStrong }]}>
                      {lookingUpBarcode ? 'Looking up product…' : 'Point at the barcode on the package.'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.cameraHeadline, { fontFamily: Fonts.serif, color: colors.ink }]}>
                      Point at your plate
                    </Text>
                    <Text style={[styles.cameraSubtitle, { fontFamily: Fonts.sans, color: colors.mutedStrong }]}>
                      I'll name the food and estimate the macros. You correct me if I'm wrong.
                    </Text>
                  </>
                )
              ) : (
                <View style={{ alignItems: 'center', marginBottom: 22 }}>
                  <Text style={[styles.cameraHeadline, { fontFamily: Fonts.serif, color: colors.ink }]}>
                    Camera access needed
                  </Text>
                  <Text style={[styles.cameraSubtitle, { fontFamily: Fonts.sans, color: colors.mutedStrong }]}>
                    {permission && !permission.canAskAgain
                      ? "Enable camera access in Settings so I can see your plate and estimate calories."
                      : "I'll need your camera to see your plate and estimate calories."}
                  </Text>
                  <PillButton
                    label={permission && !permission.canAskAgain ? 'Open Settings' : 'Enable Camera'}
                    colors={colors}
                    onPress={() => {
                      if (permission && !permission.canAskAgain) Linking.openSettings();
                      else requestPermission();
                    }}
                    style={{ marginTop: 14, paddingHorizontal: 28, alignSelf: 'center' }}
                  />
                </View>
              )}

              {!!analyzeError && !barcodeMode && (
                <Text style={{ color: colors.danger, fontSize: 12.5, textAlign: 'center', marginBottom: 12 }}>
                  {analyzeError}
                </Text>
              )}
              {!!barcodeError && barcodeMode && (
                <Text style={{ color: colors.danger, fontSize: 12.5, textAlign: 'center', marginBottom: 12 }}>
                  {barcodeError}
                </Text>
              )}

              {barcodeMode ? (
                <View style={{ alignItems: 'center' }}>
                  {lookingUpBarcode && <ActivityIndicator color={colors.signal} style={{ marginBottom: 12 }} />}
                  <PillButton label="Cancel" colors={colors} tone="ghost" onPress={closeBarcode} />
                </View>
              ) : (
                <View style={styles.cameraActionRow}>
                  <TouchableOpacity onPress={pickFromLibrary} style={styles.cameraActionCol} activeOpacity={0.7}>
                    <View style={[styles.cameraActionIcon, { backgroundColor: colors.surfaceInset }]}>
                      <ImageIcon size={21} color={colors.mutedStrong} />
                    </View>
                    <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 10.5, color: colors.mutedStrong }}>Library</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={capturePhoto}
                    activeOpacity={0.85}
                    disabled={capturing}
                    style={[styles.shutterBtn, { backgroundColor: colors.signal, opacity: capturing ? 0.7 : 1 }]}
                  >
                    {capturing ? (
                      <ActivityIndicator color={colors.signalForeground} />
                    ) : (
                      <Camera size={30} color={colors.signalForeground} strokeWidth={2.2} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setBarcodeMode(true)} style={styles.cameraActionCol} activeOpacity={0.7}>
                    <View style={[styles.cameraActionIcon, { backgroundColor: colors.surfaceInset }]}>
                      <ScanBarcode size={21} color={colors.mutedStrong} />
                    </View>
                    <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 10.5, color: colors.mutedStrong }}>Barcode</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {!barcodeMode && (
            <View style={[styles.cameraFooter, { backgroundColor: colors.surfaceRaised, borderTopColor: colors.hairline, paddingBottom: insets.bottom + 20 }]}>
              <TouchableOpacity
                onPress={() => setDescribeMode(true)}
                style={[styles.footerSearchRow, { backgroundColor: colors.surfaceInset }]}
                activeOpacity={0.7}
              >
                <Search size={17} color={colors.mutedForeground} />
                <Text style={{ flex: 1, fontFamily: Fonts.sans, fontSize: 14, color: colors.mutedForeground }}>
                  Or type it — "200g chicken, 1 cup rice"
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  mealPills: { flex: 1, flexDirection: 'row', borderRadius: 10, padding: 3, gap: 2 },
  mealPill: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  descInput: { borderRadius: 10, padding: 12, fontSize: 13, fontFamily: Fonts.sans, minHeight: 48 },
  sectionHeaderRow: { marginTop: 10 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 13 },
  tileAdd: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11 },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1 },

  // Camera-first capture sheet (mockup "1d")
  cameraTopRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  overlayIconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  overlayMealPills: { flexDirection: 'row', gap: 3, borderRadius: 10, padding: 3 },
  overlayMealPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  viewfinderFrame: { position: 'absolute', left: 44, right: 44, height: 250, borderRadius: 24, borderWidth: 1.5 },
  cameraBottomScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 230 },
  cameraBottomBlock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingBottom: 26 },
  cameraHeadline: { fontSize: 24, lineHeight: 30, textAlign: 'center', marginBottom: 6 },
  cameraSubtitle: { fontSize: 12.5, lineHeight: 19, textAlign: 'center', marginBottom: 26, paddingHorizontal: 8 },
  cameraActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cameraActionCol: { alignItems: 'center', gap: 7, width: 76 },
  cameraActionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  shutterBtn: {
    width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#F59148', shadowOpacity: 0.36, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  cameraFooter: { flex: 0, borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 14 },
  footerSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, paddingHorizontal: 15, paddingVertical: 13 },
});
