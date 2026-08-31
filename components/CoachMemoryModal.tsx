import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { clearCoachMemory } from '../lib/coachMemory';
import { dark } from '../lib/theme';

export default function CoachMemoryModal({
  visible,
  onClose,
  memory,
  onCleared,
}: {
  visible: boolean;
  onClose: () => void;
  memory: string | null;
  onCleared: () => void;
}) {
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClear = async () => {
    setClearing(true);
    setError(null);
    try {
      await clearCoachMemory();
      onCleared();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setClearing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>What Your Coach Remembers</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>

          <ScrollView>
            <Text style={styles.hint}>
              Your coach periodically folds real patterns from your chats — preferences, limitations, goals —
              into this summary, and uses it to give more personal answers over time. Nothing here is guessed;
              it only reflects what actually came up in conversation, and you can clear it any time.
            </Text>

            {memory ? (
              <View style={styles.memoryBox}>
                <Text style={styles.memoryText}>{memory}</Text>
              </View>
            ) : (
              <Text style={styles.empty}>
                Nothing remembered yet — keep chatting and your coach will start building this after a handful
                of conversations.
              </Text>
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            {memory && (
              <Pressable style={styles.clearButton} onPress={handleClear} disabled={clearing}>
                {clearing ? (
                  <ActivityIndicator color={dark.danger} />
                ) : (
                  <Text style={styles.clearButtonText}>Clear Memory</Text>
                )}
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: dark.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: dark.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: dark.text,
    fontSize: 17,
    fontWeight: '700',
  },
  close: {
    color: dark.accent,
    fontWeight: '600',
  },
  hint: {
    color: dark.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  memoryBox: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  memoryText: {
    color: dark.text,
    fontSize: 14,
    lineHeight: 21,
  },
  empty: {
    color: dark.textFaint,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 24,
    lineHeight: 19,
  },
  error: {
    color: dark.danger,
    fontSize: 12,
    marginBottom: 12,
  },
  clearButton: {
    borderWidth: 1,
    borderColor: dark.danger,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  clearButtonText: {
    color: dark.danger,
    fontWeight: '700',
    fontSize: 13,
  },
});
