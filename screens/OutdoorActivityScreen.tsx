import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import RouteMap from '../components/RouteMap';
import { useAiGate } from '../hooks/useAiGate';
import { startCheckout } from '../lib/billing';
import {
  computeRouteDistanceMeters,
  deleteOutdoorActivity,
  fetchMyOutdoorActivities,
  formatDistance,
  formatDuration,
  formatPace,
  saveOutdoorActivity,
} from '../lib/outdoorActivities';
import { dark } from '../lib/theme';
import type { OutdoorActivity, OutdoorActivityType, RoutePoint } from '../lib/types';

// Tracking, stats, and history stay free for everyone -- only the live map
// view is Premium. Shown in place of <RouteMap> for free users so the gate
// is visible right where the value is (a real drawn route), not a separate
// paywall screen blocking tracking itself.
function PremiumMapGate({ upgrading, onUpgrade }: { upgrading: boolean; onUpgrade: () => void }) {
  return (
    <View style={styles.mapGate}>
      <Text style={styles.mapGateTitle}>🔒 Live map view is a Premium feature</Text>
      <Text style={styles.mapGateText}>Your route is still being tracked and saved. Upgrade to see it drawn live.</Text>
      <Pressable style={styles.mapGateButton} onPress={onUpgrade} disabled={upgrading}>
        {upgrading ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.mapGateButtonText}>Upgrade to Premium</Text>}
      </Pressable>
    </View>
  );
}

const ACTIVITY_TYPES: { value: OutdoorActivityType; label: string; emoji: string }[] = [
  { value: 'run', label: 'Run', emoji: '🏃' },
  { value: 'walk', label: 'Walk', emoji: '🚶' },
  { value: 'ride', label: 'Ride', emoji: '🚴' },
];

type Mode = 'idle' | 'tracking' | 'paused' | 'summary';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function OutdoorActivityScreen() {
  const [mode, setMode] = useState<Mode>('idle');
  const [activityType, setActivityType] = useState<OutdoorActivityType>('run');
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [history, setHistory] = useState<OutdoorActivity[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const aiGate = useAiGate();
  const isPremium = aiGate.isPremium === true;
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await startCheckout();
    } finally {
      setUpgrading(false);
    }
  };

  const watchSubRef = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accumulatedSecondsRef = useRef(0);
  const segmentStartRef = useRef<number>(0);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await fetchMyOutdoorActivities());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    loadHistory().finally(() => setLoadingHistory(false));
  }, [loadHistory]);

  useEffect(() => {
    return () => {
      watchSubRef.current?.remove();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const distanceMeters = computeRouteDistanceMeters(route);

  const startTimer = () => {
    segmentStartRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(accumulatedSecondsRef.current + (Date.now() - segmentStartRef.current) / 1000);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    accumulatedSecondsRef.current += (Date.now() - segmentStartRef.current) / 1000;
    setElapsedSeconds(accumulatedSecondsRef.current);
  };

  const handleStart = async () => {
    setError(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setError('Location permission is needed to track an outdoor activity.');
      return;
    }

    setRoute([]);
    accumulatedSecondsRef.current = 0;
    setElapsedSeconds(0);
    setStartedAt(new Date().toISOString());
    setMode('tracking');
    startTimer();

    watchSubRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 5 },
      (loc) => {
        setRoute((prev) => [...prev, { lat: loc.coords.latitude, lng: loc.coords.longitude, t: loc.timestamp }]);
      }
    );
  };

  const handlePause = () => {
    watchSubRef.current?.remove();
    watchSubRef.current = null;
    stopTimer();
    setMode('paused');
  };

  const handleResume = () => {
    setMode('tracking');
    startTimer();
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 5 },
      (loc) => {
        setRoute((prev) => [...prev, { lat: loc.coords.latitude, lng: loc.coords.longitude, t: loc.timestamp }]);
      }
    ).then((sub) => {
      watchSubRef.current = sub;
    });
  };

  const handleStop = () => {
    watchSubRef.current?.remove();
    watchSubRef.current = null;
    if (mode === 'tracking') stopTimer();
    setMode('summary');
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveOutdoorActivity({
        activityType,
        startedAt: startedAt ?? new Date().toISOString(),
        endedAt: new Date().toISOString(),
        distanceMeters,
        durationSeconds: Math.round(elapsedSeconds),
        route,
      });
      setMode('idle');
      setRoute([]);
      setElapsedSeconds(0);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    Alert.alert('Discard activity?', 'This will not be saved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          setMode('idle');
          setRoute([]);
          setElapsedSeconds(0);
        },
      },
    ]);
  };

  const handleDeleteHistory = async (id: string) => {
    try {
      await deleteOutdoorActivity(id);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const pace = formatPace(distanceMeters, elapsedSeconds);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Outdoor</Text>
      <Text style={styles.subtitle}>Track a real GPS run, walk, or ride.</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      {mode === 'idle' && (
        <View style={styles.card}>
          <Text style={styles.label}>Activity type</Text>
          <View style={styles.typeRow}>
            {ACTIVITY_TYPES.map((t) => (
              <Pressable
                key={t.value}
                style={[styles.typeChip, activityType === t.value && styles.typeChipActive]}
                onPress={() => setActivityType(t.value)}
              >
                <Text style={styles.typeEmoji}>{t.emoji}</Text>
                <Text style={[styles.typeLabel, activityType === t.value && styles.typeLabelActive]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.startButton} onPress={handleStart}>
            <Text style={styles.startButtonText}>▶ Start Tracking</Text>
          </Pressable>
        </View>
      )}

      {(mode === 'tracking' || mode === 'paused') && (
        <View style={styles.card}>
          {isPremium ? <RouteMap route={route} /> : <PremiumMapGate upgrading={upgrading} onUpgrade={handleUpgrade} />}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatDuration(elapsedSeconds)}</Text>
              <Text style={styles.statLabel}>Time</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatDistance(distanceMeters)}</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{pace ?? '--'}</Text>
              <Text style={styles.statLabel}>Pace</Text>
            </View>
          </View>

          <View style={styles.controlRow}>
            {mode === 'tracking' ? (
              <Pressable style={styles.pauseButton} onPress={handlePause}>
                <Text style={styles.pauseButtonText}>⏸ Pause</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.pauseButton} onPress={handleResume}>
                <Text style={styles.pauseButtonText}>▶ Resume</Text>
              </Pressable>
            )}
            <Pressable style={styles.stopButton} onPress={handleStop}>
              <Text style={styles.stopButtonText}>⏹ Stop</Text>
            </Pressable>
          </View>
        </View>
      )}

      {mode === 'summary' && (
        <View style={styles.card}>
          <Text style={styles.summaryTitle}>
            {ACTIVITY_TYPES.find((t) => t.value === activityType)?.emoji}{' '}
            {ACTIVITY_TYPES.find((t) => t.value === activityType)?.label} complete
          </Text>
          {isPremium ? <RouteMap route={route} /> : <PremiumMapGate upgrading={upgrading} onUpgrade={handleUpgrade} />}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatDuration(elapsedSeconds)}</Text>
              <Text style={styles.statLabel}>Time</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatDistance(distanceMeters)}</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{pace ?? '--'}</Text>
              <Text style={styles.statLabel}>Pace</Text>
            </View>
          </View>
          <View style={styles.controlRow}>
            <Pressable style={styles.discardButton} onPress={handleDiscard} disabled={saving}>
              <Text style={styles.discardButtonText}>Discard</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.saveButtonText}>Save Activity</Text>}
            </Pressable>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>History</Text>
      {loadingHistory ? (
        <ActivityIndicator color={dark.accent} style={{ marginTop: 12 }} />
      ) : history.length === 0 ? (
        <Text style={styles.empty}>No outdoor activities logged yet.</Text>
      ) : (
        history.map((a) => (
          <View key={a.id} style={styles.historyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.historyTitle}>
                {ACTIVITY_TYPES.find((t) => t.value === a.activity_type)?.emoji} {a.activity_type} · {formatWhen(a.started_at)}
              </Text>
              <Text style={styles.historyDetail}>
                {formatDistance(a.distance_meters)} · {formatDuration(a.duration_seconds)}
                {formatPace(a.distance_meters, a.duration_seconds) ? ` · ${formatPace(a.distance_meters, a.duration_seconds)}` : ''}
              </Text>
            </View>
            <Pressable onPress={() => handleDeleteHistory(a.id)}>
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mapGate: {
    height: 180,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: dark.accentDark,
    backgroundColor: dark.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  mapGateTitle: { color: dark.text, fontSize: 14, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  mapGateText: { color: dark.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 12, lineHeight: 17 },
  mapGateButton: { backgroundColor: dark.accent, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  mapGateButtonText: { color: '#0a0a0a', fontWeight: '700', fontSize: 12 },
  container: { flex: 1, backgroundColor: dark.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: dark.text },
  subtitle: { fontSize: 13, color: dark.textFaint, marginTop: 4, marginBottom: 16 },
  error: { color: dark.danger, marginBottom: 12, fontSize: 13 },
  card: { borderWidth: 1, borderColor: dark.border, backgroundColor: dark.surface, borderRadius: 16, padding: 16, marginBottom: 20 },
  label: { color: dark.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeChip: { flex: 1, borderWidth: 1, borderColor: dark.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  typeChipActive: { borderColor: dark.accent, backgroundColor: dark.surfaceElevated },
  typeEmoji: { fontSize: 22, marginBottom: 4 },
  typeLabel: { fontSize: 12, fontWeight: '600', color: dark.textMuted },
  typeLabelActive: { color: dark.accent },
  startButton: { backgroundColor: dark.accent, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  startButtonText: { color: '#0a0a0a', fontWeight: '700', fontSize: 14 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 },
  stat: { alignItems: 'center' },
  statValue: { color: dark.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: dark.textFaint, fontSize: 11, fontWeight: '700', marginTop: 2 },
  controlRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  pauseButton: { flex: 1, borderWidth: 1, borderColor: dark.accent, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  pauseButtonText: { color: dark.accent, fontWeight: '700', fontSize: 13 },
  stopButton: { flex: 1, backgroundColor: dark.danger, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  stopButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  summaryTitle: { color: dark.text, fontSize: 16, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  discardButton: { flex: 1, borderWidth: 1, borderColor: dark.border, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  discardButtonText: { color: dark.textMuted, fontWeight: '700', fontSize: 13 },
  saveButton: { flex: 1, backgroundColor: dark.accent, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  saveButtonText: { color: '#0a0a0a', fontWeight: '700', fontSize: 13 },
  sectionTitle: { color: dark.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  empty: { color: dark.textFaint, fontSize: 12, textAlign: 'center', marginTop: 8 },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: dark.border,
    backgroundColor: dark.surface, borderRadius: 10, padding: 12, marginBottom: 8,
  },
  historyTitle: { color: dark.text, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  historyDetail: { color: dark.textMuted, fontSize: 12, marginTop: 2 },
  deleteText: { color: dark.danger, fontSize: 12, fontWeight: '600' },
});
