import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { dark } from '../lib/theme';

const MILESTONE_ICON: Record<number, string> = {
  7: '🔥',
  30: '🥉',
  50: '🥈',
  100: '🥇',
  365: '👑',
};

const MILESTONE_MESSAGE: Record<number, string> = {
  7: "One week strong. The habit is starting to stick.",
  30: "A full month. That's not luck, that's consistency.",
  50: '50 days. You are officially someone who shows up.',
  100: "Triple digits. Most people never get here.",
  365: 'A whole year. Absolutely legendary.',
};

export default function MilestoneCelebrationModal({
  milestone,
  onClose,
}: {
  milestone: number | null;
  onClose: () => void;
}) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (milestone == null) return;
    scale.setValue(0.5);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [milestone, scale, opacity]);

  if (milestone == null) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
          <Text style={styles.icon}>{MILESTONE_ICON[milestone] ?? '🎉'}</Text>
          <Text style={styles.title}>{milestone}-Day Streak!</Text>
          <Text style={styles.message}>
            {MILESTONE_MESSAGE[milestone] ?? "New milestone unlocked. Keep it going."}
          </Text>
          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Nice</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: dark.surface,
    borderWidth: 1,
    borderColor: dark.accent,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  icon: {
    fontSize: 56,
    marginBottom: 12,
  },
  title: {
    color: dark.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
  },
  message: {
    color: dark.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  button: {
    backgroundColor: dark.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
});
