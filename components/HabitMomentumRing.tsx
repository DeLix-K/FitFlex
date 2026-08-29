import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { dark } from '../lib/theme';

const RING_SIZE = 112;
const RING_STROKE = 10;

// Discrete "temperature" tiers rather than a continuously-animated
// gradient -- still visually rewards progress without fighting the rest of
// the app's fixed dark theme on every other tab.
function gradientForPct(pct: number): [string, string] {
  if (pct >= 100) return ['#134e2a', '#22c55e'];
  if (pct >= 67) return ['#1e2f22', '#16a34a'];
  if (pct >= 34) return ['#1a2a33', '#0e7490'];
  return ['#1c1f26', '#334155'];
}

function ringColorForPct(pct: number): string {
  if (pct >= 100) return '#22c55e';
  if (pct >= 67) return dark.accent;
  if (pct >= 34) return '#22d3ee';
  return '#64748b';
}

export default function HabitMomentumRing({
  completionPct,
  message,
  momentumStreak,
  freezeBalance,
}: {
  completionPct: number;
  message: string;
  momentumStreak: number;
  freezeBalance: number;
}) {
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, completionPct));
  const offset = circumference * (1 - clamped / 100);
  const [gradFrom, gradTo] = gradientForPct(clamped);

  return (
    <LinearGradient colors={[gradFrom, gradTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.headerStat}>🔥 {momentumStreak} Day{momentumStreak === 1 ? '' : 's'}</Text>
        <Text style={styles.headerStat}>🛡️ {freezeBalance} Freeze{freezeBalance === 1 ? '' : 's'}</Text>
      </View>

      <View style={styles.ringRow}>
        <View style={{ width: RING_SIZE, height: RING_SIZE }}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={radius}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={RING_STROKE}
              fill="none"
            />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={radius}
              stroke={ringColorForPct(clamped)}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
              rotation={-90}
              origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
            />
          </Svg>
          <View style={styles.ringCenter}>
            <Text style={styles.ringPct}>{Math.round(clamped)}%</Text>
          </View>
        </View>
        <Text style={styles.message}>{message}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: dark.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerStat: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  ringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ringCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPct: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  message: {
    flex: 1,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
