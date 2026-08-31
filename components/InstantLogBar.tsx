import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dark } from '../lib/theme';

export default function InstantLogBar({
  onSnap,
  onVoice,
  onBarcode,
  onSearch,
  onMenu,
}: {
  onSnap: () => void;
  onVoice: () => void;
  onBarcode: () => void;
  onSearch: () => void;
  onMenu: () => void;
}) {
  return (
    <View>
      <View style={styles.row}>
        <Pressable style={styles.button} onPress={onSnap}>
          <Text style={styles.icon}>📸</Text>
          <Text style={styles.label}>Snap Meal</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={onVoice}>
          <Text style={styles.icon}>🎙️</Text>
          <Text style={styles.label}>Voice Log</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={onBarcode}>
          <Text style={styles.icon}>📱</Text>
          <Text style={styles.label}>Scan Barcode</Text>
        </Pressable>
      </View>
      <View style={styles.secondaryRow}>
        <Pressable style={styles.secondaryButton} onPress={onSearch}>
          <Text style={styles.secondaryText}>🔍 Search Database</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onMenu}>
          <Text style={styles.secondaryText}>📋 Menu Scanner</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  button: {
    flex: 1,
    backgroundColor: dark.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  icon: {
    fontSize: 22,
    marginBottom: 4,
  },
  label: {
    color: '#0a0a0a',
    fontWeight: '700',
    fontSize: 11,
    textAlign: 'center',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryText: {
    color: dark.textMuted,
    fontWeight: '600',
    fontSize: 12,
  },
});
