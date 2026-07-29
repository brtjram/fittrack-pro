import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Keyboard, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUp, ArrowUpRight, Sparkles, Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { Fonts } from '../theme/fonts';
import { getToken } from '../services/auth-storage';

const API_BASE = __DEV__
  ? 'http://localhost:3000'
  : (process.env.EXPO_PUBLIC_API_URL ?? 'https://myfittrack.pro');

const SUGGESTED = [
  'What should I eat after a workout?',
  'How do I break a strength plateau?',
  'Is today a good day to train hard?',
];

const QUICK_REPLIES = ['Change the split', 'Adjust the pace', 'Explain these numbers'];

const SPLIT_LABEL: Record<string, string> = {
  ppl: 'PPL', upper_lower: 'Upper/Lower', full_body: 'Full body', bro_split: 'Body part split',
};

const PLAN_MARKER = '<<<PLAN>>>';

interface PlanSummary {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  split?: string;
  stepTarget?: number;
  applied?: string[];
  details?: string[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  plan?: PlanSummary | null;
}

function splitPlan(text: string): { display: string; plan: PlanSummary | null | undefined } {
  const idx = text.indexOf(PLAN_MARKER);
  if (idx === -1) return { display: text, plan: undefined };
  const display = text.slice(0, idx).replace(/\n$/, '');
  try {
    return { display, plan: JSON.parse(text.slice(idx + PLAN_MARKER.length)) };
  } catch {
    // Sentinel JSON hasn't fully arrived yet — keep showing prior plan state (undefined)
    return { display, plan: undefined };
  }
}

export function ChatScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  // Reacts to the keyboard's own reported height instead of KeyboardAvoidingView's
  // measured on-screen position — that measurement can still be stale/zero when
  // this screen is reached mid-navigation-transition (e.g. from a dismissing
  // modal), which left the keyboard covering the input with no padding applied.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages([...next, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);

    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: next }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      let accumulated = '';
      const setFromAccumulated = () => {
        const { display, plan } = splitPlan(accumulated);
        setMessages([...next, { role: 'assistant', content: display, plan }]);
      };

      // Try streaming first; fall back to res.text() if body is unavailable (RN/Hermes limitation)
      if (res.body && typeof res.body.getReader === 'function') {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setFromAccumulated();
        }
      } else {
        accumulated = await res.text();
        setFromAccumulated();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages([...next, { role: 'assistant', content: `Sorry, something went wrong (${msg}). Please try again.` }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  const lastMessage = messages[messages.length - 1];
  const showQuickReplies = !loading && lastMessage?.role === 'assistant' && !!lastMessage.plan;

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.canvas, paddingBottom: keyboardHeight }}
    >
      <View style={{ paddingTop: insets.top + 18, paddingHorizontal: 24, paddingBottom: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.signal, alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={18} color={colors.signalForeground} strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.ink }}>Your coach</Text>
            <Text style={{ fontFamily: Fonts.sans, fontSize: 11.5, color: colors.mutedForeground, marginTop: 1 }}>
              Knows your last 6 weeks · not medical advice
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && (
          <View>
            <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 20, marginBottom: 22 }}>
              <Text style={{ fontFamily: Fonts.serif, fontSize: 20, lineHeight: 27, color: colors.ink }}>
                Ask me anything about your training, nutrition, or progress.
              </Text>
              <Text style={{ fontFamily: Fonts.sans, fontSize: 12.5, lineHeight: 19, color: colors.mutedForeground, marginTop: 10 }}>
                I can see your sessions, your macros and your trend — and no, this isn't medical advice.
              </Text>
            </View>
            <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, letterSpacing: 1.2, color: colors.mutedForeground, textTransform: 'uppercase', marginBottom: 12 }}>
              Try asking
            </Text>
            <View style={{ gap: 8 }}>
              {SUGGESTED.map((q) => (
                <TouchableOpacity
                  key={q}
                  onPress={() => send(q)}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 14, padding: 15 }}
                >
                  <Text style={{ flex: 1, fontFamily: Fonts.sansMedium, fontSize: 13.5, color: colors.ink }}>{q}</Text>
                  <ArrowUpRight size={15} color={colors.signal} strokeWidth={2.4} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {messages.map((m, i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            <View
              style={{
                maxWidth: '82%',
                backgroundColor: m.role === 'user' ? colors.signal : colors.surface,
                borderRadius: 18,
                paddingHorizontal: 16,
                paddingVertical: 13,
              }}
            >
              {m.content
                ? (
                  <Text style={{ fontFamily: Fonts.sans, fontSize: 13.5, lineHeight: 21, color: m.role === 'user' ? colors.signalForeground : colors.ink }}>
                    {m.content}
                  </Text>
                )
                : loading && i === messages.length - 1
                  ? <ActivityIndicator size="small" color={colors.signal} />
                  : null}
              {m.plan && <PlanCard colors={colors} plan={m.plan} />}
            </View>
          </View>
        ))}

        {showQuickReplies && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
            {QUICK_REPLIES.map((q) => (
              <TouchableOpacity
                key={q}
                onPress={() => send(q)}
                style={{ borderRadius: 99, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline }}
              >
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11.5, color: colors.mutedStrong }}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 12 }} />
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 }}>
        <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 13, paddingHorizontal: 16, justifyContent: 'center' }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask your coach…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => send(input)}
            editable={!loading}
            style={{ fontFamily: Fonts.sans, fontSize: 13.5, color: colors.ink, maxHeight: 100, paddingVertical: 14 }}
          />
        </View>
        <TouchableOpacity
          onPress={() => send(input)}
          disabled={!input.trim() || loading}
          activeOpacity={0.85}
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: colors.signal,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: !input.trim() || loading ? 0.4 : 1,
          }}
        >
          {loading
            ? <ActivityIndicator size="small" color={colors.signalForeground} />
            : <ArrowUp size={20} color={colors.signalForeground} strokeWidth={2.6} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PlanCard({ colors, plan }: { colors: any; plan: PlanSummary }) {
  const hasNutrition = typeof plan.calories === 'number';
  // Lighter-weight than a pre-apply preview: changes still apply immediately
  // (consistent with how every other auto-apply surface in the app works),
  // but the exact detail — which dates got which workouts, the reasoning
  // behind a nutrition change — is one tap away right here instead of hidden.
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{ marginTop: 12, backgroundColor: colors.surfaceRaised, borderRadius: 16, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' }}>
      <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 10, letterSpacing: 1, color: colors.progress, textTransform: 'uppercase', padding: 14, paddingBottom: 0 }}>
        Plan
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
        {hasNutrition && (
          <>
            <PlanStat colors={colors} label="Calories" value={`${Math.round(plan.calories!).toLocaleString()}`} />
            {typeof plan.protein === 'number' && <PlanStat colors={colors} label="Protein" value={`${Math.round(plan.protein)} g`} />}
            {typeof plan.carbs === 'number' && <PlanStat colors={colors} label="Carbs" value={`${Math.round(plan.carbs)} g`} />}
            {typeof plan.fat === 'number' && <PlanStat colors={colors} label="Fat" value={`${Math.round(plan.fat)} g`} />}
          </>
        )}
        {plan.split && <PlanStat colors={colors} label="Training" value={SPLIT_LABEL[plan.split] ?? plan.split} />}
        {typeof plan.stepTarget === 'number' && <PlanStat colors={colors} label="Steps" value={plan.stepTarget.toLocaleString()} />}
      </View>
      {/* Built from exactly which tools succeeded server-side (see api/chat's
          succeededToolResults) — never shown for a tool that was only attempted,
          so this can't claim a change applied when it actually failed. */}
      {!!plan.applied?.length && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.hairline, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingTop: 12, paddingBottom: plan.details?.length ? 6 : 14 }}>
            <Check size={13} color={colors.progress} strokeWidth={3} />
            <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 11.5, color: colors.progress, flex: 1 }}>
              Applied · {plan.applied.join(' & ')} updated
            </Text>
          </View>
          {!!plan.details?.length && (
            <>
              <TouchableOpacity
                onPress={() => setExpanded((v) => !v)}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingBottom: 12 }}
              >
                <Text style={{ fontFamily: Fonts.sansMedium, fontSize: 11, color: colors.mutedForeground }}>
                  {expanded ? 'Hide details' : 'See exactly what changed'}
                </Text>
                {expanded
                  ? <ChevronUp size={12} color={colors.mutedForeground} />
                  : <ChevronDown size={12} color={colors.mutedForeground} />}
              </TouchableOpacity>
              {expanded && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
                  {plan.details.map((detail, i) => (
                    <Text key={i} style={{ fontFamily: Fonts.sans, fontSize: 12, lineHeight: 18, color: colors.mutedStrong }}>
                      {detail}
                    </Text>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

function PlanStat({ colors, label, value }: { colors: any; label: string; value: string }) {
  return (
    <View style={{ width: '50%', paddingHorizontal: 14, paddingBottom: 12 }}>
      <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 9, letterSpacing: 0.7, color: colors.mutedForeground, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.ink, marginTop: 4 }}>{value}</Text>
    </View>
  );
}
