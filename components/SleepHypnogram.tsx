import { StyleSheet, Text, View } from 'react-native';
import { parseHypnogram } from '../lib/sleep';
import { dark } from '../lib/theme';

const STAGE_COLOR: Record<string, string> = {
  awake: dark.danger,
  rem: '#818cf8',
  light: dark.accent,
  deep: dark.accentDark,
  unknown: dark.border,
};

// Depth on screen mimics a real hypnogram: awake sits highest, deep sleep
// lowest, so the shape reads like the night's actual sleep architecture.
const STAGE_HEIGHT_PCT: Record<string, number> = {
  awake: 100,
  rem: 72,
  light: 50,
  deep: 26,
  unknown: 10,
};

function formatDuration(minutes: number | null): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export default function SleepHypnogram({
  sleepPhase5min,
  bedtime,
  wakeTime,
  deepMinutes,
  remMinutes,
}: {
  sleepPhase5min: string | null;
  bedtime: string | null;
  wakeTime: string | null;
  deepMinutes: number | null;
  remMinutes: number | null;
}) {
  const segments = parseHypnogram(sleepPhase5min);

  if (segments.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Last Night's Sleep Stages</Text>
        <Text style={styles.emptyText}>
          A stage-by-stage graph appears here once Oura syncs a night with stage data.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Last Night's Sleep Stages</Text>
      {(bedtime || wakeTime) && (
        <Text style={styles.timeRange}>
          {bedtime ? new Date(bedtime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—'}
          {' → '}
          {wakeTime ? new Date(wakeTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—'}
        </Text>
      )}

      <View style={styles.graph}>
        {segments.map((seg, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              {
                height: `${STAGE_HEIGHT_PCT[seg.stage]}%`,
                backgroundColor: STAGE_COLOR[seg.stage],
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.legendRow}>
        <LegendDot color={dark.danger} label="Awake" />
        <LegendDot color="#818cf8" label="REM" />
        <LegendDot color={dark.accent} label="Light" />
        <LegendDot color={dark.accentDark} label="Deep" />
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>REM: {formatDuration(remMinutes)}</Text>
        <Text style={styles.summaryText}>Deep: {formatDuration(deepMinutes)}</Text>
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
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
    marginBottom: 14,
  },
  title: {
    color: dark.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyText: {
    color: dark.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  timeRange: {
    color: dark.textFaint,
    fontSize: 11,
    marginBottom: 10,
  },
  graph: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 70,
    gap: 1,
    marginBottom: 10,
  },
  segment: {
    flex: 1,
    borderRadius: 1,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: dark.textFaint,
    fontSize: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
  },
  summaryText: {
    color: dark.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
