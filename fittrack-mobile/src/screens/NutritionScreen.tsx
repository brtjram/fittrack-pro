import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Modal, FlatList, ActivityIndicator, StyleSheet, Image,
} from 'react-native';
import { ChevronLeft, ChevronRight, Plus, Trash2, Search, X, Camera, Upload, Sparkles, Check, Clock, AlertCircle, Pencil } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useTheme } from '../theme/useTheme';
import * as api from '../services/api';
import type { AnalyzedFoodItem } from '../services/api';
import { calculateMacroTargets, calculateAdaptiveAdjustment } from '@fittrack/core/src/algorithms/macro-calculator';
import { foods as COMMON_FOODS } from '@fittrack/core/src/data/foods';
import { toDateString } from '../utils/date';
import type { FoodLogEntry, FoodItem, MacroTargets } from '@fittrack/core';

interface ReviewItem extends AnalyzedFoodItem {
  id: string;
  included: boolean;
}

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
const meals: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

interface EditEntryState {
  foodName: string;
  servings: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

export function NutritionScreen() {
  const { colors } = useTheme();
  const [date, setDate] = useState(toDateString());
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [targets, setTargets] = useState<MacroTargets>({ calories: 2000, protein: 180, carbs: 200, fat: 65 });
  const [searchMeal, setSearchMeal] = useState<MealType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState<'common' | 'usda'>('common');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([]);
  const [adjustmentNote, setAdjustmentNote] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<EditEntryState | null>(null);

  // ==================== Photo food logging ====================
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoDescription, setPhotoDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [reviewItems, setReviewItems] = useState<ReviewItem[] | null>(null);
  const [analyzedNotes, setAnalyzedNotes] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [log, profile, weights] = await Promise.all([
      api.getFoodLogByDate(date),
      api.getUserProfile(),
      api.getWeightEntries(30),
    ]);
    setEntries(log);
    if (profile) {
      const macros = calculateMacroTargets(profile);
      const adj = calculateAdaptiveAdjustment(macros.calories, weights, profile.goal);
      setTargets(adj.shouldAdjust ? {
        ...macros,
        calories: adj.newCalories,
        carbs: macros.carbs + Math.round(adj.adjustment / 4),
      } : macros);
      setAdjustmentNote(adj.reason);
    }
  }, [date]);

  useEffect(() => { loadData(); }, [loadData]);

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const changeDate = (delta: number) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setDate(toDateString(d));
  };

  const isToday = date === toDateString();

  // Zero-query defaults: recently logged foods for this meal, fetched when the
  // search modal opens (mirrors MacroFactor surfacing favorites/recent before typing).
  useEffect(() => {
    if (!searchMeal) { setRecentFoods([]); return; }
    api.getRecentFoods(searchMeal, 10).then(setRecentFoods).catch(() => setRecentFoods([]));
  }, [searchMeal]);

  // Search logic
  useEffect(() => {
    if (!searchMeal) return;
    if (tab === 'common') {
      const q = searchQuery.toLowerCase();
      if (q.length < 1) {
        setSearchResults(recentFoods.length > 0 ? recentFoods : COMMON_FOODS.slice(0, 20));
      } else {
        setSearchResults(COMMON_FOODS.filter((f: FoodItem) => f.name.toLowerCase().includes(q)));
      }
    } else {
      if (searchQuery.length < 2) { setSearchResults([]); return; }
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSearching(true);
        const results = await api.searchUSDAFoods(searchQuery);
        setSearchResults(results);
        setSearching(false);
      }, 400);
    }
  }, [searchQuery, tab, searchMeal, recentFoods]);

  const handleAddFood = async (food: FoodItem, servings: number) => {
    if (!searchMeal) return;
    const factor = (food.servingSizeG * servings) / 100;
    await api.addFoodLogEntry({
      date,
      foodItemId: food.id,
      foodName: food.name,
      servings,
      servingSizeG: food.servingSizeG,
      meal: searchMeal,
      calories: food.caloriesPer100g * factor,
      protein: food.proteinPer100g * factor,
      carbs: food.carbsPer100g * factor,
      fat: food.fatPer100g * factor,
    });
    setSearchMeal(null);
    setSearchQuery('');
    loadData();
  };

  const handleDeleteEntry = async (id: string) => {
    await api.deleteFoodLogEntry(id);
    loadData();
  };

  const startEditEntry = (entry: FoodLogEntry) => {
    if (!entry.id) return;
    setEditingEntryId(entry.id);
    setEditEntry({
      foodName: entry.foodName,
      servings: String(entry.servings),
      calories: String(Math.round(entry.calories)),
      protein: String(Math.round(entry.protein)),
      carbs: String(Math.round(entry.carbs)),
      fat: String(Math.round(entry.fat)),
    });
  };

  const cancelEditEntry = () => {
    setEditingEntryId(null);
    setEditEntry(null);
  };

  const saveEditEntry = async () => {
    if (!editingEntryId || !editEntry) return;
    await api.updateFoodLogEntry(editingEntryId, {
      foodName: editEntry.foodName,
      servings: Number(editEntry.servings) || 0,
      calories: Number(editEntry.calories) || 0,
      protein: Number(editEntry.protein) || 0,
      carbs: Number(editEntry.carbs) || 0,
      fat: Number(editEntry.fat) || 0,
    });
    cancelEditEntry();
    loadData();
  };

  // ==================== Photo food logging ====================

  const resetPhotoState = useCallback(() => {
    setPhotoUri(null);
    setPhotoBase64(null);
    setPhotoDescription('');
    setAnalyzeError('');
    setReviewItems(null);
    setAnalyzedNotes(null);
  }, []);

  const closePhotoModal = useCallback(() => {
    setPhotoModalOpen(false);
    resetPhotoState();
  }, [resetPhotoState]);

  const processPickedImage = useCallback(async (uri: string) => {
    const image = await ImageManipulator.manipulate(uri).resize({ width: 1024 }).renderAsync();
    const result = await image.saveAsync({ base64: true, compress: 0.82, format: SaveFormat.JPEG });
    setPhotoUri(result.uri);
    setPhotoBase64(result.base64 ?? null);
  }, []);

  const takePhoto = useCallback(async () => {
    setAnalyzeError('');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setAnalyzeError('Camera permission is required to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.9 });
    if (!result.canceled && result.assets[0]) await processPickedImage(result.assets[0].uri);
  }, [processPickedImage]);

  const pickFromLibrary = useCallback(async () => {
    setAnalyzeError('');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setAnalyzeError('Photo library permission is required to upload a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.9 });
    if (!result.canceled && result.assets[0]) await processPickedImage(result.assets[0].uri);
  }, [processPickedImage]);

  const analyzePhoto = useCallback(async () => {
    if (!photoBase64) return;
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      const data = await api.analyzeFoodPhoto(photoBase64, 'image/jpeg', photoDescription.trim() || undefined);
      setReviewItems(data.items.map((item, i) => ({ ...item, id: `${Date.now()}-${i}`, included: true })));
      setAnalyzedNotes(data.notes ?? null);
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : 'Could not analyze this photo. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }, [photoBase64, photoDescription]);

  const updateReviewItem = (id: string, patch: Partial<ReviewItem>) => {
    setReviewItems((prev) => prev?.map((item) => (item.id === id ? { ...item, ...patch } : item)) ?? null);
  };

  const confirmReviewItems = async () => {
    if (!reviewItems || !searchMeal) return;
    const toLog = reviewItems.filter((i) => i.included);
    if (toLog.length === 0) return;

    await Promise.all(toLog.map((item) => api.addFoodLogEntry({
      date,
      foodItemId: `photo-${item.id}`,
      foodName: item.name,
      servings: 1,
      servingSizeG: item.servingSizeG || 1,
      meal: searchMeal,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
    })));

    closePhotoModal();
    setSearchMeal(null);
    setSearchQuery('');
    loadData();
  };

  const remaining = Math.round(targets.calories - totals.calories);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView>
        <View style={styles.content}>
          {/* Date Selector */}
          <View style={styles.dateRow}>
            <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateBtn}>
              <ChevronLeft size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.dateText, { color: colors.foreground }]}>
              {isToday ? 'Today' : new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => changeDate(1)} disabled={isToday} style={[styles.dateBtn, { opacity: isToday ? 0.3 : 1 }]}>
              <ChevronRight size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Macro Summary */}
          <View style={[styles.macroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.remainingNum, { color: remaining < 0 ? colors.destructive : colors.foreground }]}>
              {remaining}
            </Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground }}>calories remaining</Text>

            <View style={styles.macroRow}>
              <MacroBar label="Protein" current={totals.protein} target={targets.protein} color={colors.chart1} colors={colors} />
              <MacroBar label="Carbs" current={totals.carbs} target={targets.carbs} color={colors.chart3} colors={colors} />
              <MacroBar label="Fat" current={totals.fat} target={targets.fat} color={colors.chart4} colors={colors} />
            </View>
          </View>

          {/* Adaptive Adjustment Note */}
          {!!adjustmentNote && (
            <View style={[styles.adjustmentNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <AlertCircle size={14} color={colors.primary} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 11, color: colors.mutedForeground, lineHeight: 16 }}>{adjustmentNote}</Text>
            </View>
          )}

          {/* Meals */}
          {meals.map((meal) => {
            const mealEntries = entries.filter((e) => e.meal === meal);
            const mealCals = mealEntries.reduce((a, e) => a + e.calories, 0);
            return (
              <View key={meal} style={[styles.mealCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.mealHeader}>
                  <View>
                    <Text style={[styles.mealTitle, { color: colors.foreground }]}>
                      {meal.charAt(0).toUpperCase() + meal.slice(1)}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                      {Math.round(mealCals)} cal
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: colors.border }]}
                    onPress={() => { setSearchMeal(meal); setSearchQuery(''); setTab('common'); }}
                    activeOpacity={0.7}
                  >
                    <Plus size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                {mealEntries.map((entry) =>
                  entry.id && editingEntryId === entry.id && editEntry ? (
                    <View key={entry.id} style={[styles.editEntryBox, { borderTopColor: colors.border }]}>
                      <TextInput
                        value={editEntry.foodName}
                        onChangeText={(v) => setEditEntry({ ...editEntry, foodName: v })}
                        style={[styles.editNameInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                        placeholderTextColor={colors.mutedForeground}
                      />
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {([
                          ['servings', 'srv'],
                          ['calories', 'cal'],
                          ['protein', 'P'],
                          ['carbs', 'C'],
                          ['fat', 'F'],
                        ] as const).map(([key, label]) => (
                          <View key={key} style={{ flex: 1, alignItems: 'center' }}>
                            <TextInput
                              value={editEntry[key]}
                              onChangeText={(v) => setEditEntry({ ...editEntry, [key]: v })}
                              keyboardType="numeric"
                              style={[styles.editFieldInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                            />
                            <Text style={{ fontSize: 9, color: colors.mutedForeground, marginTop: 2 }}>{label}</Text>
                          </View>
                        ))}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={saveEditEntry}
                          style={[styles.editActionBtn, { flex: 1, backgroundColor: colors.primary }]}
                          activeOpacity={0.8}
                        >
                          <Check size={14} color={colors.primaryForeground ?? '#fff'} />
                          <Text style={{ color: colors.primaryForeground ?? '#fff', fontWeight: '600', fontSize: 12 }}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={cancelEditEntry}
                          style={[styles.editActionBtn, { borderWidth: 1, borderColor: colors.border }]}
                          activeOpacity={0.8}
                        >
                          <X size={14} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View key={entry.id} style={[styles.entryRow, { borderTopColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, color: colors.foreground }}>{entry.foodName}</Text>
                        <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1 }}>
                          {Math.round(entry.calories)} cal · {Math.round(entry.protein)}p · {Math.round(entry.carbs)}c · {Math.round(entry.fat)}f
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => startEditEntry(entry)} activeOpacity={0.6} style={{ marginRight: 14 }}>
                        <Pencil size={15} color={colors.mutedForeground} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteEntry(entry.id!)} activeOpacity={0.6}>
                        <Trash2 size={16} color={colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  )
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Food Search Modal */}
      <Modal visible={searchMeal !== null} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Add to {searchMeal ? searchMeal.charAt(0).toUpperCase() + searchMeal.slice(1) : ''}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <TouchableOpacity
                onPress={() => { resetPhotoState(); setPhotoModalOpen(true); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Camera size={18} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setSearchMeal(null); setSearchQuery(''); }}>
                <X size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tabs */}
          <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'common' && { backgroundColor: colors.card }]}
              onPress={() => setTab('common')}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: tab === 'common' ? colors.foreground : colors.mutedForeground }}>
                Common Foods
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'usda' && { backgroundColor: colors.card }]}
              onPress={() => setTab('usda')}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: tab === 'usda' ? colors.foreground : colors.mutedForeground }}>
                USDA Database
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={[styles.searchRow, { borderBottomColor: colors.border }]}>
            <Search size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={tab === 'common' ? 'Search common foods...' : 'Search USDA database...'}
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />
            {searching && <ActivityIndicator size="small" color={colors.primary} />}
          </View>

          {/* Results */}
          {tab === 'common' && searchQuery.length === 0 && recentFoods.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 }}>
              <Clock size={12} color={colors.mutedForeground} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.mutedForeground }}>Recently logged</Text>
            </View>
          )}
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.foodResult, { borderBottomColor: colors.border }]}
                onPress={() => handleAddFood(item, 1)}
                activeOpacity={0.6}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: colors.foreground }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                    {item.servingSizeG}g · {Math.round(item.caloriesPer100g * item.servingSizeG / 100)} cal · {Math.round(item.proteinPer100g * item.servingSizeG / 100)}g protein
                  </Text>
                </View>
                <Plus size={18} color={colors.primary} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                  {tab === 'usda' && searchQuery.length < 2
                    ? 'Type at least 2 characters to search USDA'
                    : 'No results found'}
                </Text>
              </View>
            }
          />
        </View>
      </Modal>

      {/* Photo Food Logging Modal */}
      <Modal visible={photoModalOpen} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Log with Photo</Text>
            <TouchableOpacity onPress={closePhotoModal}>
              <X size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {!photoUri && !reviewItems && (
              <View style={{ alignItems: 'center', gap: 16, paddingVertical: 24 }}>
                <Sparkles size={32} color={colors.primary} />
                <Text style={{ textAlign: 'center', fontSize: 13, color: colors.mutedForeground, maxWidth: 260 }}>
                  Take or upload a photo of your meal and the AI coach will estimate what&apos;s in it and its calories/macros.
                </Text>
                <TouchableOpacity
                  onPress={takePhoto}
                  style={[styles.photoActionBtn, { backgroundColor: colors.primary }]}
                  activeOpacity={0.8}
                >
                  <Camera size={16} color={colors.primaryForeground ?? '#fff'} />
                  <Text style={{ color: colors.primaryForeground ?? '#fff', fontWeight: '600', fontSize: 14 }}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={pickFromLibrary}
                  style={[styles.photoActionBtn, { borderWidth: 1, borderColor: colors.border }]}
                  activeOpacity={0.8}
                >
                  <Upload size={16} color={colors.foreground} />
                  <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14 }}>Upload Photo</Text>
                </TouchableOpacity>
                {!!analyzeError && <Text style={{ color: colors.destructive, fontSize: 13, textAlign: 'center' }}>{analyzeError}</Text>}
              </View>
            )}

            {photoUri && !reviewItems && (
              <View style={{ gap: 12 }}>
                <Image source={{ uri: photoUri }} style={{ width: '100%', height: 220, borderRadius: 12 }} resizeMode="cover" />
                <TextInput
                  value={photoDescription}
                  onChangeText={setPhotoDescription}
                  placeholder='Optional: add context (e.g. "grilled, no oil")'
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 13, color: colors.foreground, minHeight: 44 }}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={analyzePhoto}
                    disabled={analyzing}
                    style={[styles.photoActionBtn, { flex: 1, backgroundColor: colors.primary, opacity: analyzing ? 0.6 : 1 }]}
                    activeOpacity={0.8}
                  >
                    {analyzing
                      ? <ActivityIndicator size="small" color={colors.primaryForeground ?? '#fff'} />
                      : <Sparkles size={16} color={colors.primaryForeground ?? '#fff'} />}
                    <Text style={{ color: colors.primaryForeground ?? '#fff', fontWeight: '600', fontSize: 14 }}>
                      {analyzing ? 'Analyzing...' : 'Analyze Photo'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={resetPhotoState}
                    disabled={analyzing}
                    style={[styles.photoActionBtn, { borderWidth: 1, borderColor: colors.border }]}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 14 }}>Retake</Text>
                  </TouchableOpacity>
                </View>
                {!!analyzeError && <Text style={{ color: colors.destructive, fontSize: 13 }}>{analyzeError}</Text>}
              </View>
            )}

            {reviewItems && (
              <View style={{ gap: 10 }}>
                {photoUri && <Image source={{ uri: photoUri }} style={{ width: '100%', height: 140, borderRadius: 12 }} resizeMode="cover" />}
                {!!analyzedNotes && (
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, backgroundColor: colors.muted, padding: 8, borderRadius: 8 }}>
                    {analyzedNotes}
                  </Text>
                )}
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                  Review and adjust before logging — these are AI estimates, not exact measurements.
                </Text>
                {reviewItems.map((item) => (
                  <View key={item.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => updateReviewItem(item.id, { included: !item.included })}
                        style={[styles.checkbox, { borderColor: colors.border }, item.included && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      >
                        {item.included && <Check size={12} color={colors.primaryForeground ?? '#fff'} />}
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <TextInput
                          value={item.name}
                          onChangeText={(v) => updateReviewItem(item.id, { name: v })}
                          style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, padding: 0 }}
                        />
                        <TextInput
                          value={item.servingDescription}
                          onChangeText={(v) => updateReviewItem(item.id, { servingDescription: v })}
                          style={{ fontSize: 12, color: colors.mutedForeground, padding: 0, marginTop: 2 }}
                        />
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {([
                        ['calories', 'cal'],
                        ['protein', 'P'],
                        ['carbs', 'C'],
                        ['fat', 'F'],
                      ] as const).map(([key, label]) => (
                        <View key={key} style={{ flex: 1, alignItems: 'center' }}>
                          <TextInput
                            value={String(Math.round(item[key]))}
                            onChangeText={(v) => updateReviewItem(item.id, { [key]: Number(v) || 0 })}
                            keyboardType="numeric"
                            style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, width: '100%', textAlign: 'center', fontSize: 12, color: colors.foreground, paddingVertical: 4 }}
                          />
                          <Text style={{ fontSize: 9, color: colors.mutedForeground, marginTop: 2 }}>{label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={confirmReviewItems}
                  disabled={!reviewItems.some((i) => i.included)}
                  style={[styles.photoActionBtn, { backgroundColor: colors.primary, opacity: reviewItems.some((i) => i.included) ? 1 : 0.5 }]}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: colors.primaryForeground ?? '#fff', fontWeight: '600', fontSize: 14 }}>
                    Log {reviewItems.filter((i) => i.included).length} item{reviewItems.filter((i) => i.included).length === 1 ? '' : 's'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function MacroBar({ label, current, target, color, colors }: {
  label: string; current: number; target: number; color: string; colors: any;
}) {
  const pct = target > 0 ? Math.min(current / target, 1) : 0;
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
        <View style={[styles.barFill, { backgroundColor: color, height: `${pct * 100}%` }]} />
      </View>
      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.foreground, marginTop: 6 }}>
        {Math.round(current)}g
      </Text>
      <Text style={{ fontSize: 10, color: colors.mutedForeground }}>/ {Math.round(target)}g</Text>
      <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateBtn: { padding: 8 },
  dateText: { fontSize: 16, fontWeight: '600' },
  macroCard: { borderWidth: 1, borderRadius: 12, padding: 20, alignItems: 'center' },
  remainingNum: { fontSize: 32, fontWeight: '700' },
  macroRow: { flexDirection: 'row', marginTop: 20, gap: 16, width: '100%' },
  barTrack: { width: 8, height: 60, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4 },
  mealCard: { borderWidth: 1, borderRadius: 12, padding: 14 },
  mealHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mealTitle: { fontSize: 15, fontWeight: '600' },
  addBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  entryRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingTop: 10, marginTop: 10 },
  adjustmentNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 10, padding: 10 },
  editEntryBox: { borderTopWidth: 1, paddingTop: 10, marginTop: 10, gap: 8 },
  editNameInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13 },
  editFieldInput: { borderWidth: 1, borderRadius: 6, width: '100%', textAlign: 'center', fontSize: 12, paddingVertical: 4 },
  editActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 8 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  tabRow: { flexDirection: 'row', margin: 16, borderRadius: 8, padding: 2 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 4 },
  foodResult: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  photoActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, alignSelf: 'stretch' },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
});
