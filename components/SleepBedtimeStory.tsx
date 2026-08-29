import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { saveHistoryEntry } from '../lib/aiHistory';
import { askClaude, buildBedtimeStoryPrompt } from '../lib/claude';
import { dark } from '../lib/theme';
import { speak, stopSpeaking } from '../lib/voice';

export default function SleepBedtimeStory() {
  const [theme, setTheme] = useState('');
  const [story, setStory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    stopSpeaking();
    setSpeaking(false);
    try {
      const text = await askClaude(buildBedtimeStoryPrompt(theme.trim()));
      setStory(text);
      saveHistoryEntry('bedtime_story', text);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleReadAloud = () => {
    if (!story) return;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      speak(story);
      setSpeaking(true);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>📖 Bedtime Story</Text>
      <Text style={styles.hint}>AI-written on demand and read aloud on-device — a fresh one each time.</Text>

      <TextInput
        style={styles.input}
        value={theme}
        onChangeText={setTheme}
        placeholder="Theme (optional) — e.g. a quiet walk through a forest"
        placeholderTextColor={dark.textFaint}
      />

      <Pressable style={styles.generateButton} onPress={generate} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#0a0a0a" size="small" />
        ) : (
          <Text style={styles.generateButtonText}>{story ? 'Write a New Story' : 'Write a Story'}</Text>
        )}
      </Pressable>

      {error && <Text style={styles.error}>{error}</Text>}

      {story && (
        <View style={styles.storyBox}>
          <Text style={styles.storyText}>{story}</Text>
          <Pressable style={styles.readButton} onPress={toggleReadAloud}>
            <Text style={styles.readButtonText}>{speaking ? '⏸ Stop Reading' : '🔊 Read Aloud'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  title: {
    color: dark.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  hint: {
    color: dark.textFaint,
    fontSize: 11,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surfaceElevated,
    color: dark.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginBottom: 10,
  },
  generateButton: {
    backgroundColor: dark.accent,
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
    fontSize: 13,
  },
  error: {
    color: dark.danger,
    fontSize: 12,
    marginTop: 10,
  },
  storyBox: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: dark.border,
    paddingTop: 14,
  },
  storyText: {
    color: dark.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  readButton: {
    borderWidth: 1,
    borderColor: dark.accent,
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  readButtonText: {
    color: dark.accent,
    fontWeight: '700',
    fontSize: 13,
  },
});
