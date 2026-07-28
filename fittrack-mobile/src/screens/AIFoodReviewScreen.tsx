import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Check, Minus, Plus, MessageSquareText } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { PillButton } from '../components/ui';
import * as api from '../services/api';
import type { AnalyzedFoodItem } from '../services/api';
import type { MealType } from '@fittrack/core';

interface ReviewItem extends AnalyzedFoodItem {
  id: string;
  included: boolean;
}

function confidenceBadge(c: AnalyzedFoodItem['confidence']) {
  if (c === 'high') return { label: 'SURE', bg: 'rgba(201,232,74,0.14)', fg: '#C9E84A' };
  if (c === 'medium') return { label: 'CHECK PORTION', bg: 'rgba(245,145,72,0.15)', fg: '#F59148' };
  return { label: 'LOW CONFIDENCE', bg: 'rgba(228,87,76,0.15)', fg: '#E4574C' };
}

export function AIFoodReviewScreen({ route, navigation }: { route: any; navigation: any }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { photoUri, meal, date, items, notes } = route.params as {
    photoUri: string | null; meal: MealType; date: string; items: AnalyzedFoodItem[]; notes: string | null;
  };
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>(
    items.map((item, i) => ({ ...item, id: `${Date.now()}-${i}`, included: true })),
  );
  const [saving, setSaving] = useState(false);

  const update = (id: string, patch: Partial<ReviewItem>) => {
    setReviewItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  // Portion +/- scales the whole nutritional profile together (not just
  // calories) so the macro breakdown stays consistent with what's shown.
  const adjustPortion = (item: ReviewItem, direction: 1 | -1) => {
    const factor = 1 + direction * 0.1;
    update(item.id, {
      calories: Math.max(0, Math.round(item.calories * factor)),
      protein: Math.max(0, Math.round(item.protein * factor * 10) / 10),
      carbs: Math.max(0, Math.round(item.carbs * factor * 10) / 10),
      fat: Math.max(0, Math.round(item.fat * factor * 10) / 10),
      servingSizeG: Math.max(0, Math.round(item.servingSizeG * factor)),
    });
  };

  const addMissed = () => {
    setReviewItems((prev) => [...prev, {
      id: `manual-${Date.now()}`,
      name: 'New item',
      servingDescription: '1 serving',
      servingSizeG: 100,
      calories: 100,
      protein: 0,
      carbs: 0,
      fat: 0,
      confidence: 'low',
      included: true,
    }]);
  };

  const includedItems = reviewItems.filter((i) => i.included);
  const totalCalories = Math.round(includedItems.reduce((a, i) => a + i.calories, 0));
  const totalProtein = Math.round(includedItems.reduce((a, i) => a + i.protein, 0));

  const confirm = async () => {
    if (includedItems.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(includedItems.map((item) => api.addFoodLogEntry({
        date, foodItemId: `photo-${item.id}`, foodName: item.name, servings: 1,
        servingSizeG: item.servingSizeG || 1, meal,
        calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat,
      })));
      // 'MainTabs' lives on the root stack, one level up from this screen's
      // own LogFood stack (capture + review share a single modal entry now).
      navigation.getParent()?.navigate('MainTabs');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ height: photoUri ? 186 : 96 }}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ width: '100%', height: '100%', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
              <MessageSquareText size={16} color={colors.mutedForeground} />
              <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 12.5, color: colors.mutedForeground }}>From your description</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { top: insets.top + 12, backgroundColor: 'rgba(33,31,27,0.8)' }]}
          >
            <X size={18} color={colors.ink} />
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 18 }}>
          <Text style={{ fontFamily: Fonts.serif, fontSize: 24, color: colors.ink }}>
            I see {reviewItems.length} thing{reviewItems.length === 1 ? '' : 's'}
          </Text>
          <Text style={{ fontFamily: Fonts.sans, fontSize: 12.5, lineHeight: 18, color: colors.mutedStrong, marginTop: 7 }}>
            Estimates, not measurements — fix anything that looks off.{notes ? ` ${notes}` : ''}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 8 }}>
          {reviewItems.map((item) => {
            const badge = confidenceBadge(item.confidence);
            return (
              <View key={item.id} style={[styles.itemCard, { backgroundColor: colors.surface, opacity: item.included ? 1 : 0.55 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => update(item.id, { included: !item.included })}
                    style={[styles.checkbox, { backgroundColor: item.included ? colors.progress : 'transparent', borderColor: item.included ? colors.progress : colors.hairline }]}
                  >
                    {item.included && <Check size={13} color={colors.canvas} strokeWidth={3} />}
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <TextInput
                        value={item.name}
                        onChangeText={(v) => update(item.id, { name: v })}
                        style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14.5, color: colors.ink, padding: 0, flexShrink: 1, textDecorationLine: item.included ? 'none' : 'line-through' }}
                      />
                      <View style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, backgroundColor: badge.bg }}>
                        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 8.5, letterSpacing: 0.5, color: badge.fg }}>{badge.label}</Text>
                      </View>
                    </View>
                    {item.included && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9 }}>
                        <Stepper colors={colors} onPress={() => adjustPortion(item, -1)} icon="minus" />
                        <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.ink, minWidth: 78, textAlign: 'center' }}>
                          {item.servingDescription}
                        </Text>
                        <Stepper colors={colors} onPress={() => adjustPortion(item, 1)} icon="plus" />
                      </View>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 17, color: item.included ? colors.ink : colors.mutedForeground, letterSpacing: -0.3 }}>
                      {Math.round(item.calories)}
                    </Text>
                    {item.included && (
                      <Text style={{ fontFamily: Fonts.sans, fontSize: 10, color: colors.mutedForeground }}>
                        {Math.round(item.protein)}P {Math.round(item.carbs)}C {Math.round(item.fat)}F
                      </Text>
                    )}
                    {!item.included && <Text style={{ fontFamily: Fonts.sans, fontSize: 10, color: colors.mutedForeground }}>excluded</Text>}
                  </View>
                </View>
              </View>
            );
          })}

          <TouchableOpacity onPress={addMissed} style={[styles.addMissedBtn, { borderColor: colors.hairline }]} activeOpacity={0.7}>
            <Plus size={16} color={colors.signal} strokeWidth={2.5} />
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: colors.signal }}>Add something I missed</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.surfaceRaised, borderTopColor: colors.hairline }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
          <Text style={{ fontFamily: Fonts.sans, fontSize: 12, color: colors.mutedStrong }}>{label(meal)} total</Text>
          <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink }}>{totalCalories} kcal · {totalProtein}g protein</Text>
        </View>
        <PillButton
          label={`Log ${includedItems.length} item${includedItems.length === 1 ? '' : 's'}`}
          colors={colors}
          onPress={confirm}
          disabled={saving || includedItems.length === 0}
        />
      </View>
    </View>
  );
}

function label(m: MealType) { return m.charAt(0).toUpperCase() + m.slice(1); }

function Stepper({ colors, onPress, icon }: { colors: any; onPress: () => void; icon: 'minus' | 'plus' }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.stepperBtn, { backgroundColor: colors.surfaceInset }]} activeOpacity={0.7}>
      {icon === 'minus'
        ? <Minus size={14} color={colors.mutedStrong} strokeWidth={2.6} />
        : <Plus size={14} color={colors.mutedStrong} strokeWidth={2.6} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backBtn: { position: 'absolute', top: 56, left: 20, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  itemCard: { borderRadius: 16, padding: 15 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepperBtn: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  addMissedBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16, paddingVertical: 15,
  },
  footer: { padding: 16, paddingBottom: 30, borderTopWidth: 1 },
});
