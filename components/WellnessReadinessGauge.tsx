import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { calm } from '../lib/theme';

const SIZE = 120;
const STROKE = 11;

function scoreLabel(score: number | null): string {
  if (score == null) return 'Check in below to see your score';
  if (score >= 80) return "You're doing great";
  if (score >= 60) return "You're doing well";
  if (score >= 40) return 'Take it easy today';
  return 'Be gentle with yourself today';
}

export default function WellnessReadinessGauge({ score }: { score: number | null }) {
  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score != null ? Math.min(100, Math.max(0, score)) : 0;
  const offset = circumference * (1 - pct / 100);

  return (
    <View style={styles.card}>
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={radius} stroke={calm.border} strokeWidth={STROKE} fill="none" />
          {score != null && (
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={radius}
              stroke={calm.accent}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
              rotation={-90}
              origin={`${SIZE / 2}, ${SIZE / 2}`}
            />
          )}
        </Svg>
        <View style={styles.center}>
          <Text style={styles.scoreValue}>{score != null ? score : '—'}</Text>
          {score != null && <Text style={styles.scoreMax}>/100</Text>}
        </View>
      </View>
      <Text style={styles.label}>{scoreLabel(score)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: calm.border,
    backgroundColor: calm.surface,
    borderRadius: 24,
    paddingVertical: 24,
    marginBottom: 14,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    color: calm.text,
    fontSize: 30,
    fontWeight: '800',
  },
  scoreMax: {
    color: calm.textFaint,
    fontSize: 11,
    marginTop: -2,
  },
  label: {
    color: calm.accent,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
  },
});
