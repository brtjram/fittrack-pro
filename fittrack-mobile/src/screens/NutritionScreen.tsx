import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Modal, FlatList, ActivityIndicator, StyleSheet,
} from 'react-native';
import { ChevronLeft, ChevronRight, Plus, Trash2, Search, X } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import * as api from '../services/api';
import { calculateMacroTargets, calculateAdaptiveAdjustment } from '@fittrack/core/src/algorithms/macro-calculator';
import { foods as COMMON_FOODS } from '@fittrack/core/src/data/foods';
import type { FoodLogEntry, FoodItem, MacroTargets } from '@fittrack/core';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
const meals: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function toDateString(d?: Date): string {
  const dt = d ?? new Date();
  return dt.toISOString().split('T')[0];
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

  // Search logic
  useEffect(() => {
    if (!searchMeal) return;
    if (tab === 'common') {
      const q = searchQuery.toLowerCase();
      setSearchResults(q.length < 1 ? COMMON_FOODS.slice(0, 20) : COMMON_FOODS.filter((f: FoodItem) => f.name.toLowerCase().includes(q)));
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
  }, [searchQuery, tab, searchMeal]);

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
                    style={[styles.addBtn, { backgroundColor: colors.primary + '15' }]}
                    onPress={() => { setSearchMeal(meal); setSearchQuery(''); setTab('common'); }}
                    activeOpacity={0.7}
                  >
                    <Plus size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                {mealEntries.map((entry) => (
                  <View key={entry.id} style={[styles.entryRow, { borderTopColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: colors.foreground }}>{entry.foodName}</Text>
                      <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1 }}>
                        {Math.round(entry.calories)} cal · {Math.round(entry.protein)}p · {Math.round(entry.carbs)}c · {Math.round(entry.fat)}f
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteEntry(entry.id!)} activeOpacity={0.6}>
                      <Trash2 size={16} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                ))}
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
            <TouchableOpacity onPress={() => { setSearchMeal(null); setSearchQuery(''); }}>
              <X size={22} color={colors.foreground} />
            </TouchableOpacity>
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
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  tabRow: { flexDirection: 'row', margin: 16, borderRadius: 8, padding: 2 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 4 },
  foodResult: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
});
