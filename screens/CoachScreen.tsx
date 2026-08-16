import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AiUsageIndicator from '../components/AiUsageIndicator';
import { useAiGate } from '../hooks/useAiGate';
import { saveHistoryEntry } from '../lib/aiHistory';
import { askClaudeChat, buildCoachSystemPrompt, type ChatMessage } from '../lib/claude';
import { colors } from '../lib/theme';
import { supabase } from '../lib/supabase';

const SUGGEST_WORKOUT_MESSAGE = "What should I do for today's workout?";

export default function CoachScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const aiGate = useAiGate();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    supabase
      .from('workout_plans')
      .select('name, workout_plan_exercises(exercises(name))')
      .then(({ data }) => {
        const plans = (data ?? []).map((plan) => {
          const rows = (plan.workout_plan_exercises ?? []) as unknown as {
            exercises: { name: string } | { name: string }[] | null;
          }[];
          const exerciseNames = rows.flatMap((wpe) => {
            const ex = wpe.exercises;
            if (!ex) return [];
            return Array.isArray(ex) ? ex.map((e) => e.name) : [ex.name];
          });
          return { name: plan.name as string, exerciseNames };
        });
        setSystemPrompt(buildCoachSystemPrompt(plans));
      });
  }, []);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    if (!aiGate.canUse) {
      setError("You've used today's free AI actions. Upgrade to Premium for unlimited access.");
      return;
    }

    setError(null);
    setInput('');
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setSending(true);

    try {
      const reply = await askClaudeChat(nextMessages, systemPrompt ?? undefined);
      setMessages([...nextMessages, { role: 'assistant', content: reply }]);
      saveHistoryEntry('coach_chat', reply, trimmed);
      aiGate.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMessages(messages);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Coach</Text>
        <AiUsageIndicator
          isPremium={aiGate.isPremium}
          remaining={aiGate.remaining}
          loaded={aiGate.loaded}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messagesScroll}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              Ask me anything about your training, nutrition, or motivation — or try the quick
              action below.
            </Text>
            <Pressable
              style={styles.suggestButton}
              onPress={() => send(SUGGEST_WORKOUT_MESSAGE)}
            >
              <Text style={styles.suggestButtonText}>Suggest today's workout</Text>
            </Pressable>
          </View>
        )}

        {messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.bubble,
              message.role === 'user' ? styles.bubbleUser : styles.bubbleCoach,
            ]}
          >
            <Text style={message.role === 'user' ? styles.bubbleUserText : styles.bubbleCoachText}>
              {message.content}
            </Text>
          </View>
        ))}

        {sending && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" />
            <Text style={styles.loadingText}>Coach is thinking...</Text>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ask your coach..."
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
        />
        <Pressable
          style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
          onPress={() => send(input)}
          disabled={!input.trim() || sending}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  suggestButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  suggestButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  bubble: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    maxWidth: '85%',
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-end',
  },
  bubbleCoach: {
    backgroundColor: '#f1f1f1',
    alignSelf: 'flex-start',
  },
  bubbleUserText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleCoachText: {
    color: '#222',
    fontSize: 14,
    lineHeight: 20,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#666',
  },
  error: {
    color: colors.danger,
    marginBottom: 10,
    fontSize: 13,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});
