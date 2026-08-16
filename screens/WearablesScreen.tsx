import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { disconnectOura, getOuraAuthUrl, getOuraData, type OuraData } from '../lib/oura';
import { colors } from '../lib/theme';

const REDIRECT_URI = Platform.OS === 'web' && typeof window !== 'undefined'
  ? window.location.origin
  : '';

export default function WearablesScreen() {
  const [data, setData] = useState<OuraData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await getOuraData();
      setData(result);
      if (result.error) setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const handleConnect = () => {
    if (Platform.OS !== 'web') {
      setError('Connecting a wearable is currently only supported on the web version of the app.');
      return;
    }
    const state = Math.random().toString(36).slice(2);
    window.sessionStorage.setItem('oura_oauth_state', state);
    window.location.href = getOuraAuthUrl(REDIRECT_URI, state);
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await disconnectOura();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wearables</Text>
      <Text style={styles.subtitle}>Connect a fitness tracker to see your daily activity here.</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      {data?.connected ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Oura — Today</Text>
            <Pressable onPress={handleDisconnect} disabled={busy}>
              {busy ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text style={styles.disconnect}>Disconnect</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.steps.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Steps</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.calories.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Calories</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.distance} km</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{data.activeMinutes}</Text>
              <Text style={styles.statLabel}>Active min</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.notConnectedText}>No wearable connected yet.</Text>
          <Pressable style={styles.connectButton} onPress={handleConnect}>
            <Text style={styles.connectButtonText}>Connect Oura</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 16,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  disconnect: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statBox: {
    width: '45%',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  notConnectedText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  connectButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
