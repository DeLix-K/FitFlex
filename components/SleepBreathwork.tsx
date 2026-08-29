import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { speak, stopSpeaking } from '../lib/voice';
import { dark } from '../lib/theme';

// 4-7-8 breathing: a well-known, simple wind-down pattern. Pure client-side
// timer + animation, no fabricated biometric feedback of any kind.
const PHASES = [
  { name: 'Inhale', seconds: 4 },
  { name: 'Hold', seconds: 7 },
  { name: 'Exhale', seconds: 8 },
] as const;

const SESSION_OPTIONS = [
  { label: '2 min', seconds: 120 },
  { label: '5 min', seconds: 300 },
];

export default function SleepBreathwork() {
  const [running, setRunning] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(PHASES[0].seconds);
  const [elapsed, setElapsed] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(SESSION_OPTIONS[0].seconds);
  const [voiceCues, setVoiceCues] = useState(true);
  const scale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => s - 1);
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    if (elapsed >= sessionSeconds) {
      stop();
      return;
    }
    if (secondsLeft <= 0) {
      setPhaseIndex((i) => (i + 1) % PHASES.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, elapsed, running]);

  useEffect(() => {
    if (!running) return;
    const phase = PHASES[phaseIndex];
    setSecondsLeft(phase.seconds);
    if (voiceCues) speak(phase.name);

    const targetScale = phase.name === 'Exhale' ? 0.5 : 1;
    Animated.timing(scale, {
      toValue: targetScale,
      duration: phase.seconds * 1000,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseIndex, running]);

  const start = () => {
    setPhaseIndex(0);
    setSecondsLeft(PHASES[0].seconds);
    setElapsed(0);
    setRunning(true);
  };

  const stop = () => {
    setRunning(false);
    stopSpeaking();
    scale.setValue(0.5);
  };

  const currentPhase = PHASES[phaseIndex];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🌬️ Breathwork (4-7-8)</Text>

      {!running ? (
        <>
          <View style={styles.optionsRow}>
            {SESSION_OPTIONS.map((opt) => (
              <Pressable
                key={opt.label}
                style={[styles.optionChip, sessionSeconds === opt.seconds && styles.optionChipActive]}
                onPress={() => setSessionSeconds(opt.seconds)}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    sessionSeconds === opt.seconds && styles.optionChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.optionChip, voiceCues && styles.optionChipActive]}
              onPress={() => setVoiceCues((v) => !v)}
            >
              <Text style={[styles.optionChipText, voiceCues && styles.optionChipTextActive]}>
                🔈 Voice cues
              </Text>
            </Pressable>
          </View>
          <Pressable style={styles.startButton} onPress={start}>
            <Text style={styles.startButtonText}>Start Breathing Session</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.sessionArea}>
          <Animated.View style={[styles.circle, { transform: [{ scale }] }]} />
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
    marginBottom: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  optionChip: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  optionChipActive: {
    borderColor: dark.accent,
    backgroundColor: dark.surfaceElevated,
  },
  optionChipText: {
    color: dark.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  optionChipTextActive: {
    color: dark.accent,
  },
  startButton: {
    backgroundColor: dark.accent,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
    fontSize: 13,
  },
  sessionArea: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  circle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: dark.accent,
    opacity: 0.85,
    marginBottom: 16,
  },
  phaseText: {
    color: dark.text,
    fontSize: 20,
    fontWeight: '800',
  },
  secondsText: {
    color: dark.textMuted,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  stopButton: {
    borderWidth: 1,
    borderColor: dark.danger,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  stopButtonText: {
    color: dark.danger,
    fontWeight: '700',
    fontSize: 13,
  },
});
