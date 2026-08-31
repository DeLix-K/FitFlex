import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { createPackage, fetchMyPackages, togglePackageActive } from '../lib/trainerDashboard';
import { dark } from '../lib/theme';
import type { TrainerSessionPackage } from '../lib/types';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function PackageManager() {
  const [packages, setPackages] = useState<TrainerSessionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [sessionCount, setSessionCount] = useState('4');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPackages(await fetchMyPackages());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const add = async () => {
    const count = Number(sessionCount);
    const priceCents = Math.round(Number(price) * 100);
    if (!name.trim()) {
      setError('Give the package a name.');
      return;
    }
    if (!Number.isInteger(count) || count < 1) {
      setError('Enter a valid session count.');
      return;
    }
    if (!Number.isFinite(priceCents) || priceCents < 100) {
      setError('Enter a price of at least $1.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createPackage({ name: name.trim(), sessionCount: count, priceCents });
      setName('');
      setSessionCount('4');
      setPrice('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (pkg: TrainerSessionPackage) => {
    try {
      await togglePackageActive(pkg.id, !pkg.active);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (loading) return <ActivityIndicator color={dark.accent} style={{ marginVertical: 16 }} />;

  return (
    <View>
      <View style={styles.addCard}>
        <Text style={styles.label}>Package name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 4-Session Pack"
          placeholderTextColor={dark.textFaint}
          value={name}
          onChangeText={setName}
        />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Sessions</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={sessionCount} onChangeText={setSessionCount} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Price (USD)</Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="180" placeholderTextColor={dark.textFaint} value={price} onChangeText={setPrice} />
          </View>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.addButton} onPress={add} disabled={saving}>
          {saving ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.addButtonText}>+ Add Package</Text>}
        </Pressable>
      </View>

      {packages.length === 0 ? (
        <Text style={styles.empty}>No session packages yet — clients booking sessions can book freely until you add one.</Text>
      ) : (
        packages.map((pkg) => (
          <View key={pkg.id} style={styles.pkgRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pkgName}>{pkg.name}</Text>
              <Text style={styles.pkgDetail}>
                {pkg.session_count} sessions · {formatPrice(pkg.price_cents)}
              </Text>
            </View>
            <Pressable onPress={() => toggle(pkg)}>
              <Text style={[styles.toggleText, !pkg.active && styles.toggleTextInactive]}>{pkg.active ? 'Active' : 'Inactive'}</Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  addCard: { borderWidth: 1, borderColor: dark.border, backgroundColor: dark.surface, borderRadius: 14, padding: 14, marginBottom: 14 },
  label: { color: dark.textMuted, fontSize: 11, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: dark.border, backgroundColor: dark.surfaceElevated, color: dark.text, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  row: { flexDirection: 'row', gap: 10 },
  error: { color: dark.danger, marginTop: 10, fontSize: 12 },
  addButton: { backgroundColor: dark.accent, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 14 },
  addButtonText: { color: '#0a0a0a', fontWeight: '700', fontSize: 12 },
  empty: { color: dark.textFaint, fontSize: 12, textAlign: 'center', marginVertical: 8, lineHeight: 17 },
  pkgRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: dark.border, backgroundColor: dark.surface, borderRadius: 10, padding: 12, marginBottom: 8 },
  pkgName: { color: dark.text, fontSize: 14, fontWeight: '700' },
  pkgDetail: { color: dark.textMuted, fontSize: 12, marginTop: 2 },
  toggleText: { color: dark.accent, fontSize: 12, fontWeight: '700' },
  toggleTextInactive: { color: dark.textFaint },
});
