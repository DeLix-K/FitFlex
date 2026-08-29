import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { fetchMyStageProgress } from '../lib/challenges';
import { dark } from '../lib/theme';
import type { ChallengeStageProgress } from '../lib/types';

function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ChallengeStageTimeline({ challengeId }: { challengeId: string }) {
  const [stages, setStages] = useState<ChallengeStageProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchMyStageProgress(challengeId)
      .then(setStages)
      .finally(() => setLoading(false));
  }, [challengeId]);

  if (loading) return <ActivityIndicator style={{ marginVertical: 10 }} color={dark.accent} />;
  if (stages.length === 0) return null;

  const today = todayLocalDate();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🗺️ Quest Progress</Text>
      {stages.map((stage) => {
        const status = today < stage.stage_start ? 'locked' : today > stage.stage_end ? 'past' : 'active';
        const pct = Math.min(1, stage.workouts_logged / stage.target_workouts);
        const complete = stage.workouts_logged >= stage.target_workouts;

        return (
          <View key={stage.stage_id} style={styles.stageRow}>
            <View style={styles.marker}>
              <Text style={styles.markerText}>
                {complete ? '✓' : status === 'locked' ? '🔒' : stage.order_index + 1}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.stageTitle, status === 'locked' && styles.stageTitleLocked]}>
                {stage.title}
              </Text>
              {status !== 'locked' && (
                <>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
                  </View>
                  <Text style={styles.stageMeta}>
                    {stage.workouts_logged}/{stage.target_workouts} days
                    {status === 'active' ? ' · in progress' : complete ? ' · complete' : ' · missed'}
                  </Text>
                </>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: dark.border,
  },
  title: {
    color: dark.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  stageRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  marker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: dark.accent,
    backgroundColor: dark.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerText: {
    color: dark.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  stageTitle: {
    color: dark.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  stageTitleLocked: {
    color: dark.textFaint,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: dark.border,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: dark.accent,
  },
  stageMeta: {
    color: dark.textFaint,
    fontSize: 11,
  },
});
