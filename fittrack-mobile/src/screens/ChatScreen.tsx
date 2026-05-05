import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet,
} from 'react-native';
import { Send, Bot, ShieldAlert } from 'lucide-react-native';
import { useTheme } from '../theme/useTheme';
import { getToken } from '../services/auth-storage';

const API_BASE = __DEV__ ? 'http://localhost:3000' : 'https://your-app.vercel.app';

const SUGGESTED = [
  'What should I eat after a workout?',
  'How do I break a strength plateau?',
  'Is today a good day to train hard?',
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatScreen() {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

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

      if (!res.ok || !res.body) throw new Error('Request failed');

      // Stream the response
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages([...next, { role: 'assistant', content: accumulated }]);
      }
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },
    headerSub: { fontSize: 12, color: colors.mutedForeground },
    disclaimer: {
      fontSize: 10,
      color: colors.mutedForeground,
      opacity: 0.7,
      marginTop: 6,
      lineHeight: 14,
    },
    messages: { flex: 1, padding: 16 },
    suggestedContainer: { gap: 8, paddingBottom: 8 },
    suggestedLabel: { fontSize: 12, color: colors.mutedForeground, marginBottom: 4 },
    suggestedBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    suggestedText: { fontSize: 13, color: colors.foreground },
    bubble: { marginBottom: 12, maxWidth: '85%' },
    userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderRadius: 16, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
    aiBubble: { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
    userText: { fontSize: 14, color: colors.primaryForeground, lineHeight: 20 },
    aiText: { fontSize: 14, color: colors.foreground, lineHeight: 20 },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.card,
    },
    textInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.foreground,
      backgroundColor: colors.background,
      maxHeight: 100,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <Bot size={20} color={colors.primary} />
          <View>
            <Text style={s.headerTitle}>AI Coach</Text>
            <Text style={s.headerSub}>Powered by Claude</Text>
          </View>
        </View>
        <Text style={s.disclaimer}>
          AI-generated suggestions only — not medical advice. Consult a qualified professional for health concerns.
        </Text>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={s.messages}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && (
          <View style={s.suggestedContainer}>
            <Text style={s.suggestedLabel}>Ask me anything about your training or nutrition:</Text>
            {SUGGESTED.map((q) => (
              <TouchableOpacity key={q} style={s.suggestedBtn} onPress={() => send(q)} activeOpacity={0.7}>
                <Text style={s.suggestedText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {messages.map((m, i) => (
          <View key={i} style={[s.bubble, m.role === 'user' ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
            <View style={m.role === 'user' ? s.userBubble : s.aiBubble}>
              {m.content
                ? <Text style={m.role === 'user' ? s.userText : s.aiText}>{m.content}</Text>
                : loading && i === messages.length - 1
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : null}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Input */}
      <View style={s.inputRow}>
        <TextInput
          style={s.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Ask your coach…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          returnKeyType="send"
          onSubmitEditing={() => send(input)}
          editable={!loading}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}
          onPress={() => send(input)}
          disabled={!input.trim() || loading}
          activeOpacity={0.7}
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Send size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
