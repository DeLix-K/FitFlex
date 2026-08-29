import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { calm } from '../lib/theme';

// The well-known 5-4-3-2-1 grounding technique, paced to fit roughly 60
// seconds. Kept completely free, deliberately not paywalled like the rest
// of this tab's premium content -- an in-the-moment stress tool shouldn't
// have a paywall between someone and it.
const STEPS = [
  { text: 'Notice 5 things you can see around you.', seconds: 10 },
  { text: 'Notice 4 things you can physically feel.', seconds: 8 },
  { text: 'Notice 3 things you can hear right now.', seconds: 8 },
  { text: 'Notice 2 things you can smell.', seconds: 8 },
  { text: 'Notice 1 thing you can taste.', seconds: 6 },
  { text: 'Take one slow breath in... and out.', seconds: 10 },
  { text: "You're safe. You're doing great.", seconds: 10 },
];

function safeHaptic(fn: () => Promise<void>) {
  fn().catch(() => {});
}

export default function StressInterrupter() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(interval);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    if (secondsLeft <= 0) {
      if (stepIndex + 1 >= STEPS.length) {
        setActive(false);
        return;
      }
      setStepIndex((i) => i + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, active]);

  useEffect(() => {
    if (!active) return;
    setSecondsLeft(STEPS[stepIndex].seconds);
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    pulse.setValue(1);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, active]);

  const start = () => {
    setStepIndex(0);
    setActive(true);
    safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  };

  const stop = () => {
    setActive(false);
    pulse.stopAnimation();
    pulse.setValue(1);
  };

  if (!active) {
    return (
      <Pressable style={styles.panicButton} onPress={start}>
        <Text style={styles.panicButtonText}>😰 I'm Stressed — 60-Second Reset</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.activeCard}>
      <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulse }] }]} />
      <Text style={styles.stepText}>{STEPS[stepIndex].text}</Text>
      <Text style={styles.secondsText}>{secondsLeft}s</Text>
      <Pressable style={styles.stopButton} onPress={stop}>
        <Text style={styles.stopButtonText}>Stop</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panicButton: {
    borderWidth: 1,
    borderColor: calm.danger,
    backgroundColor: calm.surface,
    borderRadius: 22,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  panicButtonText: {
    color: calm.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  activeCard: {
    borderWidth: 1,
    borderColor: calm.border,
    backgroundColor: calm.surface,
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 14,
  },
  pulseCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: calm.danger,
    opacity: 0.5,
    marginBottom: 18,
  },
  stepText: {
    color: calm.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  secondsText: {
    color: calm.textMuted,
    fontSize: 13,
    marginBottom: 16,
  },
  stopButton: {
    borderWidth: 1,
    borderColor: calm.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  stopButtonText: {
    color: calm.textMuted,
    fontWeight: '700',
    fontSize: 12,
  },
});
