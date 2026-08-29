import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { startCheckout } from '../lib/billing';
import { calm } from '../lib/theme';

type Phase = { name: string; seconds: number; kind: 'in' | 'hold' | 'out' };
type Mode = { key: string; label: string; description: string; premium: boolean; phases: Phase[] };

const MODES: Mode[] = [
  {
    key: 'box',
    label: 'Box Breathing',
    description: 'Equal inhale, hold, exhale, hold — steady focus.',
    premium: false,
    phases: [
      { name: 'Inhale', seconds: 4, kind: 'in' },
      { name: 'Hold', seconds: 4, kind: 'hold' },
      { name: 'Exhale', seconds: 4, kind: 'out' },
      { name: 'Hold', seconds: 4, kind: 'hold' },
    ],
  },
  {
    key: '478',
    label: '4-7-8',
    description: 'Longer exhale than inhale — winds down for sleep.',
    premium: false,
    phases: [
      { name: 'Inhale', seconds: 4, kind: 'in' },
      { name: 'Hold', seconds: 7, kind: 'hold' },
      { name: 'Exhale', seconds: 8, kind: 'out' },
    ],
  },
  {
    key: 'sigh',
    label: 'Physiological Sigh',
    description: 'Double inhale, long exhale — fast anxiety relief.',
    premium: true,
    phases: [
      { name: 'Inhale', seconds: 2, kind: 'in' },
      { name: 'Inhale Again', seconds: 1, kind: 'in' },
      { name: 'Exhale Slowly', seconds: 6, kind: 'out' },
    ],
  },
];

function safeHaptic(fn: () => Promise<void>) {
  fn().catch(() => {});
}

export default function BreathworkSphere({ isPremium }: { isPremium: boolean }) {
  const [modeKey, setModeKey] = useState('box');
  const [running, setRunning] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [upgrading, setUpgrading] = useState(false);
  const scale = useRef(new Animated.Value(0.6)).current;

  const mode = MODES.find((m) => m.key === modeKey) ?? MODES[0];

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    if (secondsLeft <= 0) {
      setPhaseIndex((i) => (i + 1) % mode.phases.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, running]);

  useEffect(() => {
    if (!running) return;
    const phase = mode.phases[phaseIndex];
    setSecondsLeft(phase.seconds);
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

    const target = phase.kind === 'out' ? 0.6 : phase.kind === 'in' ? 1 : undefined;
    if (target != null) {
      Animated.timing(scale, { toValue: target, duration: phase.seconds * 1000, useNativeDriver: true }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIndex, running]);

  const start = () => {
    setPhaseIndex(0);
    setRunning(true);
  };

  const stop = () => {
    setRunning(false);
    scale.setValue(0.6);
  };

  const handleSelectMode = (m: Mode) => {
    if (m.premium && !isPremium) return;
    stop();
    setModeKey(m.key);
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await startCheckout();
    } finally {
      setUpgrading(false);
    }
  };

  const currentPhase = mode.phases[phaseIndex];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🌬️ Breathwork & Stress Reset</Text>

      <View style={styles.modeRow}>
        {MODES.map((m) => {
          const locked = m.premium && !isPremium;
          return (
            <Pressable
              key={m.key}
              style={[styles.modeChip, modeKey === m.key && styles.modeChipActive]}
              onPress={() => handleSelectMode(m)}
            >
              <Text style={[styles.modeChipText, modeKey === m.key && styles.modeChipTextActive]}>
                {locked ? '🔒 ' : ''}
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.modeDescription}>{mode.description}</Text>

      {mode.premium && !isPremium ? (
        <Pressable style={styles.unlockButton} onPress={handleUpgrade} disabled={upgrading}>
          {upgrading ? (
            <ActivityIndicator color="#0a0a0a" size="small" />
          ) : (
            <Text style={styles.unlockButtonText}>🔒 Unlock with Premium</Text>
          )}
        </Pressable>
      ) : !running ? (
        <Pressable style={styles.startButton} onPress={start}>
          <Text style={styles.startButtonText}>Start</Text>
        </Pressable>
      ) : (
        <View style={styles.sessionArea}>
          <Animated.View style={[styles.sphere, { transform: [{ scale }] }]} />
          <Text style={styles.phaseText}>{currentPhase.name}</Text>
          <Text style={styles.secondsText}>{secondsLeft}s</Text>
          <Pressable style={styles.stopButton} onPress={stop}>
            <Text style={styles.stopButtonText}>Stop</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: calm.border,
    backgroundColor: calm.surface,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  title: {
    color: calm.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  modeChip: {
    borderWidth: 1,
    borderColor: calm.border,
    borderRadius: 18,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  modeChipActive: {
    borderColor: calm.accent,
    backgroundColor: calm.surfaceElevated,
  },
  modeChipText: {
    color: calm.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  modeChipTextActive: {
    color: calm.accent,
  },
  modeDescription: {
    color: calm.textFaint,
    fontSize: 12,
    marginBottom: 14,
  },
  startButton: {
    backgroundColor: calm.accent,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#0a2420',
    fontWeight: '700',
    fontSize: 14,
  },
  unlockButton: {
    backgroundColor: calm.accent,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  unlockButtonText: {
    color: '#0a2420',
    fontWeight: '700',
    fontSize: 13,
  },
  sessionArea: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  sphere: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: calm.accent,
    opacity: 0.8,
    marginBottom: 18,
  },
  phaseText: {
    color: calm.text,
    fontSize: 20,
    fontWeight: '700',
  },
  secondsText: {
    color: calm.textMuted,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  stopButton: {
    borderWidth: 1,
    borderColor: calm.danger,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  stopButtonText: {
    color: calm.danger,
    fontWeight: '700',
    fontSize: 13,
  },
});
