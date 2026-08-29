import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dark } from '../lib/theme';

const HOLD_REPEAT_MS = 150;

function safeHaptic(fn: () => Promise<void>) {
  fn().catch(() => {});
}

export default function TactileNumberStepper({
  value,
  step,
  min = 0,
  suffix,
  onChange,
}: {
  value: number;
  step: number;
  min?: number;
  suffix?: string;
  onChange: (next: number) => void;
}) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const tick = (delta: number) => {
    valueRef.current = Math.max(min, Math.round((valueRef.current + delta) * 100) / 100);
    onChange(valueRef.current);
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  };

  const startHold = (delta: number) => {
    tick(delta);
    intervalRef.current = setInterval(() => tick(delta), HOLD_REPEAT_MS);
  };

  const stopHold = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  return (
    <View style={styles.row}>
      <Pressable style={styles.button} onPressIn={() => startHold(-step)} onPressOut={stopHold}>
        <Text style={styles.buttonText}>−</Text>
      </Pressable>
      <View style={styles.valueBox}>
        <Text style={styles.valueText}>
          {value}
          {suffix ? ` ${suffix}` : ''}
        </Text>
      </View>
      <Pressable style={styles.button} onPressIn={() => startHold(step)} onPressOut={stopHold}>
        <Text style={styles.buttonText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: dark.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: dark.accent,
    fontSize: 20,
    fontWeight: '700',
  },
  valueBox: {
    minWidth: 90,
    alignItems: 'center',
  },
  valueText: {
    color: dark.text,
    fontSize: 20,
    fontWeight: '800',
  },
});
