import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Modal, FlatList, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Plus, Search, X, Clock, Minus, Camera, ScanBarcode } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Ring, SwipeToDelete, CoachBubble } from '../components/ui';
import * as api from '../services/api';
import { calculateMacroTargets, calculateAdaptiveAdjustment } from '@fittrack/core/src/algorithms/macro-calculator';
import { foods as COMMON_FOODS } from '@fittrack/core/src/data/foods';
import type { FoodLogEntry, FoodItem, MacroTargets } from '@fittrack/core';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
const meals: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function toDateString(d?: Date): string {
  const dt = d ?? new Date();
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Day log editor — view/edit what's logged for a date and add foods manually
// via search. Photo logging lives in LogFoodScreen + AIFoodReviewScreen now;
// this screen is the fallback/manual-edit path reached from a food entry.
export function NutritionScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState(toDateString());
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [targets, setTargets] = useState<MacroTargets>({ calories: 2000, protein: 180, carbs: 200, fat: 65 });
  const [searchMeal, setSearchMeal] = useState<MealType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editServings, setEditServings] = useState(1);

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

  // Zero-query defaults: top 5 recently logged foods for this meal, fetched
  // when the search modal opens (mirrors MacroFactor surfacing favorites/
  // recent before typing).
  useEffect(() => {
    if (!searchMeal) { setRecentFoods([]); return; }
    api.getRecentFoods(searchMeal, 5).then(setRecentFoods).catch(() => setRecentFoods([]));
  }, [searchMeal]);

  // One unified list across recent, common, and USDA/OFF (via searchUSDAFoods,
  // which already queries both) instead of a manual tab toggle between
  // "Common Foods" and "USDA Database" — recent matches always lead, common
  // matches show instantly, and USDA/OFF results stream in once you've typed
  // enough to search them.
  useEffect(() => {
    if (!searchMeal) return;
    const q = searchQuery.toLowerCase().trim();
    if (q.length === 0) {
      setSearchResults(recentFoods.length > 0 ? recentFoods : COMMON_FOODS.slice(0, 20));
      return;
    }
    const recentMatches = recentFoods.filter((f) => f.name.toLowerCase().includes(q));
    const recentIds = new Set(recentMatches.map((f) => f.id));
    const commonMatches = COMMON_FOODS.filter((f: FoodItem) => !recentIds.has(f.id) && f.name.toLowerCase().includes(q));
    setSearchResults([...recentMatches, ...commonMatches]);
    if (q.length < 2) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const usda = await api.searchUSDAFoods(q);
      setSearchResults((prev) => [...prev, ...usda.filter((f) => !recentIds.has(f.id))]);
      setSearching(false);
    }, 400);
  }, [searchQuery, searchMeal, recentFoods]);

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
    setEditingId(entry.id ?? null);
    setEditServings(entry.servings || 1);
  };

  const saveEditServings = async (entry: FoodLogEntry, servings: number) => {
    if (!entry.id || servings <= 0) return;
    const factor = servings / (entry.servings || 1);
    await api.updateFoodLogEntry(entry.id, {
      servings,
      calories: entry.calories * factor,
      protein: entry.protein * factor,
      carbs: entry.carbs * factor,
      fat: entry.fat * factor,
      fiber: entry.fiber != null ? entry.fiber * factor : undefined,
    });
    setEditingId(null);
    loadData();
  };

  const remaining = Math.round(targets.calories - totals.calories);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Date Selector — pinned above the scroll view, not inside it. It used
          to live at the top of the scrollable content, which scrolled it out
          of reach as soon as the meal list grew past one screen (this screen
          also has no native header anymore now that it's a tab root, so it
          needs its own safe-area top padding too). */}
      <View style={[styles.dateRow, { paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
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

      <ScrollView
        // Clears the floating CoachBubble (48px tall, floating 16px above
        // the tab bar) so a swiped-to-delete entry at the bottom of the
        // last meal never rests underneath it.
        contentContainerStyle={{ paddingBottom: 80 }}
      >
        <View style={styles.content}>
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

          {/* Meals */}
          {meals.map((meal) => {
            const mealEntries = entries.filter((e) => e.meal === meal);
            const mealCals = mealEntries.reduce((a, e) => a + e.calories, 0);
            return (
              <View key={meal} style={[styles.mealCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.mealHeader}>
                  <View>
                    {/* A distinct accent color (not colors.foreground, which
                        food-item names also use) so meal headers read as
                        section titles at a glance instead of blending in
                        with the entries listed under them. */}
                    <Text style={[styles.mealTitle, { color: colors.primary }]}>
                      {meal.charAt(0).toUpperCase() + meal.slice(1)}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 2 }}>
                      {Math.round(mealCals)} cal
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: colors.border }]}
                    onPress={() => { setSearchMeal(meal); setSearchQuery(''); }}
                    activeOpacity={0.7}
                  >
                    <Plus size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                {mealEntries.map((entry) => {
                  const isEditing = editingId === entry.id;
                  const previewFactor = isEditing ? editServings / (entry.servings || 1) : 1;
                  return (
                    <View key={entry.id} style={[styles.entryRow, { borderTopColor: colors.border }]}>
                      <SwipeToDelete colors={colors} borderRadius={0} onDelete={() => handleDeleteEntry(entry.id!)}>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card }}
                          onPress={() => (isEditing ? setEditingId(null) : startEditEntry(entry))}
                          activeOpacity={0.6}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>{entry.foodName}</Text>
                            <Text style={{ fontSize: 12.5, color: colors.mutedForeground, marginTop: 3 }}>
                              {Math.round(entry.calories * previewFactor)} cal · {Math.round(entry.protein * previewFactor)}p · {Math.round(entry.carbs * previewFactor)}c · {Math.round(entry.fat * previewFactor)}f
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </SwipeToDelete>
                      {isEditing && (
                        <View style={[styles.editRow, { borderTopColor: colors.border }]}>
                          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginRight: 10 }}>Quantity</Text>
                          <TouchableOpacity
                            style={[styles.stepBtn, { borderColor: colors.border }]}
                            onPress={() => setEditServings((s) => Math.max(0.25, Math.round((s - 0.25) * 100) / 100))}
                          >
                            <Minus size={14} color={colors.foreground} />
                          </TouchableOpacity>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, minWidth: 48, textAlign: 'center' }}>
                            {editServings}×
                          </Text>
                          <TouchableOpacity
                            style={[styles.stepBtn, { borderColor: colors.border }]}
                            onPress={() => setEditServings((s) => Math.round((s + 0.25) * 100) / 100)}
                          >
                            <Plus size={14} color={colors.foreground} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.saveEditBtn, { backgroundColor: colors.primary }]}
                            onPress={() => saveEditServings(entry, editServings)}
                          >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primaryForeground }}>Save</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <CoachBubble colors={colors} onPress={() => navigation.getParent()?.navigate('Coach')} />

      {/* Food Search Modal */}
      <Modal visible={searchMeal !== null} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={styles.modalGrabberRow}>
            <View style={[styles.modalGrabber, { backgroundColor: colors.faint }]} />
          </View>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Add to {searchMeal ? searchMeal.charAt(0).toUpperCase() + searchMeal.slice(1) : ''}
            </Text>
            <TouchableOpacity onPress={() => { setSearchMeal(null); setSearchQuery(''); }}>
              <X size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Search Input — one unified search across recent, common, and USDA/OFF */}
          <View style={[styles.searchRow, { borderBottomColor: colors.border }]}>
            <Search size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search foods..."
              placeholderTextColor={colors.mutedForeground}
              autoFocus
            />
            {searching && <ActivityIndicator size="small" color={colors.primary} />}
          </View>

          {/* Escape hatch to the camera-first capture flow (photo + barcode)
              for whenever text search comes up short — always visible here
              rather than only appearing after a failed search, since a
              barcode scan is often just faster than typing anyway. Sized as
              its own tile (not a thin divider row) so it reads as a real
              second option, not fine print under the search box. */}
          <TouchableOpacity
            style={[styles.captureFallback, { backgroundColor: 'rgba(245,145,72,0.12)', borderColor: 'rgba(245,145,72,0.3)' }]}
            activeOpacity={0.7}
            onPress={() => {
              const meal = searchMeal;
              setSearchMeal(null);
              setSearchQuery('');
              navigation.getParent()?.navigate('LogFood', { screen: 'LogFoodMain', params: { meal } });
            }}
          >
            <View style={[styles.captureFallbackIcon, { backgroundColor: colors.primary }]}>
              <Camera size={19} color={colors.primaryForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground }}>Can't find it?</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                <ScanBarcode size={13} color={colors.mutedForeground} />
                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.mutedForeground }}>
                  Scan a barcode or snap a photo
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.primary} />
          </TouchableOpacity>

          {/* Results */}
          {searchQuery.length === 0 && recentFoods.length > 0 && (
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
                  {searchQuery.length === 1 ? 'Keep typing to search more sources' : 'No results found'}
                </Text>
              </View>
            }
          />
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
      <View style={{ width: 88, height: 88, alignItems: 'center', justifyContent: 'center' }}>
        <Ring size={88} stroke={8} percent={pct} trackColor={colors.muted} fillColor={color} />
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground }}>{Math.round(current)}g</Text>
        </View>
      </View>
      <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 8 }}>/ {Math.round(target)}g</Text>
      <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>{label}</Text>
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
  mealCard: { borderWidth: 1, borderRadius: 16, padding: 18 },
  mealHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mealTitle: { fontSize: 18, fontWeight: '700' },
  addBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  // Column, not row — SwipeToDelete is now the single child that needs to
  // stretch full width (column's default cross-axis stretch handles that),
  // with the quantity-edit row appearing as a second stacked child beneath it.
  entryRow: { borderTopWidth: 1, paddingTop: 14, marginTop: 14 },
  editRow: { flexDirection: 'row', alignItems: 'center', width: '100%', borderTopWidth: 1, marginTop: 12, paddingTop: 12, gap: 8 },
  stepBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  saveEditBtn: { marginLeft: 'auto', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  modalGrabberRow: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  modalGrabber: { width: 36, height: 5, borderRadius: 2.5 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  captureFallback: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, marginTop: 14, marginBottom: 4,
    paddingHorizontal: 16, paddingVertical: 16,
    borderRadius: 16, borderWidth: 1,
  },
  captureFallbackIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 4 },
  foodResult: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
});
