import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { dark } from '../lib/theme';

const RING_SIZE = 156;
const RING_STROKE = 14;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Pastel indicators against the dark backdrop, per the design brief:
// Electric Mint for Protein, Amber for Carbs, Rose for Fat.
export const MACRO_COLORS = { protein: '#2dd4bf', carbs: '#fbbf24', fat: '#fb7185' };

function MacroBar({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(1, current / target) : 0;
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, { toValue: pct, duration: 700, useNativeDriver: false }).start();
  }, [pct, widthAnim]);

  const remaining = Math.max(0, Math.round(target - current));

  return (
    <View style={styles.macroRow}>
      <View style={styles.macroHeaderRow}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>
          {Math.round(current)}g / {target}g{target > current ? ` — ${remaining}g left` : ''}
        </Text>
      </View>
      <View style={styles.macroTrack}>
        <Animated.View
          style={[
            styles.macroFill,
            { backgroundColor: color, width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>
    </View>
  );
}

export default function MacroFuelRing({
  calories,
  calorieTarget,
  workoutCaloriesBurned,
  protein,
  proteinTarget,
  carbs,
  carbTarget,
  fat,
  fatTarget,
}: {
  calories: number;
  calorieTarget: number;
  workoutCaloriesBurned: number;
  protein: number;
  proteinTarget: number;
  carbs: number;
  carbTarget: number;
  fat: number;
  fatTarget: number;
}) {
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = calorieTarget > 0 ? Math.min(1, calories / calorieTarget) : 0;
  const remaining = Math.max(0, Math.round(calorieTarget - calories));

  const progressAnim = useRef(new Animated.Value(0)).current;
  const hitProteinGoalRef = useRef(false);

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: pct, duration: 800, useNativeDriver: false }).start();
  }, [pct, progressAnim]);

  useEffect(() => {
    if (proteinTarget > 0 && protein >= proteinTarget && !hitProteinGoalRef.current) {
      hitProteinGoalRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    if (proteinTarget > 0 && protein < proteinTarget) {
      hitProteinGoalRef.current = false;
    }
  }, [protein, proteinTarget]);

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={styles.card}>
      <View style={styles.ringRow}>
        <View style={{ width: RING_SIZE, height: RING_SIZE }}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={radius} stroke={dark.border} strokeWidth={RING_STROKE} fill="none" />
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={radius}
              stroke={dark.accent}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              rotation={-90}
              origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
            />
          </Svg>
          <View style={styles.ringCenter}>
            <Text style={styles.ringRemaining}>{remaining}</Text>
            <Text style={styles.ringUnit}>kcal left</Text>
          </View>
        </View>

        <View style={styles.calorieInfo}>
          <Text style={styles.calorieTotal}>
            {Math.round(calories)} <Text style={styles.calorieTotalMuted}>/ {calorieTarget} kcal</Text>
          </Text>
          {workoutCaloriesBurned > 0 && (
            <Text style={styles.workoutAdjust}>
              🔥 +{workoutCaloriesBurned} kcal from today's workout — target auto-adjusted
            </Text>
          )}
        </View>
      </View>

      <MacroBar label="Protein" current={protein} target={proteinTarget} color={MACRO_COLORS.protein} />
      <MacroBar label="Carbs" current={carbs} target={carbTarget} color={MACRO_COLORS.carbs} />
      <MacroBar label="Fat" current={fat} target={fatTarget} color={MACRO_COLORS.fat} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  ringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 18,
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringRemaining: {
    color: dark.text,
    fontSize: 28,
    fontWeight: '900',
  },
  ringUnit: {
    color: dark.textFaint,
    fontSize: 11,
    fontWeight: '600',
  },
  calorieInfo: {
    flex: 1,
  },
  calorieTotal: {
    color: dark.text,
    fontSize: 20,
    fontWeight: '800',
  },
  calorieTotalMuted: {
    color: dark.textFaint,
    fontSize: 14,
    fontWeight: '600',
  },
  workoutAdjust: {
    color: dark.accent,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
    lineHeight: 15,
  },
  macroRow: {
    marginBottom: 12,
  },
  macroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  macroLabel: {
    color: dark.text,
    fontSize: 13,
    fontWeight: '700',
  },
  macroValue: {
    color: dark.textFaint,
    fontSize: 11,
    fontWeight: '600',
  },
  macroTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: dark.surfaceElevated,
    overflow: 'hidden',
  },
  macroFill: {
    height: 10,
    borderRadius: 5,
  },
});
