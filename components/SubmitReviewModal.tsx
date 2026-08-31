import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { submitTrainerReview } from '../lib/trainers';
import { dark } from '../lib/theme';
import type { TrainerOrderView } from '../lib/types';

export default function SubmitReviewModal({
  visible,
  order,
  onClose,
  onSubmitted,
}: {
  visible: boolean;
  order: TrainerOrderView | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setRating(5);
    setComment('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!order) return;
    setSaving(true);
    setError(null);
    try {
      await submitTrainerReview(order.id, rating, comment.trim());
      onSubmitted();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!order) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Rate {order.trainer_display_name}</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Text style={[styles.star, n <= rating && styles.starActive]}>★</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Optional comment"
            placeholderTextColor={dark.textFaint}
            value={comment}
            onChangeText={setComment}
            multiline
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelButton} onPress={handleClose} disabled={saving}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={saving}>
              {saving ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.submitButtonText}>Submit Review</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: dark.surface, borderWidth: 1, borderColor: dark.border, borderRadius: 16, padding: 20 },
  title: { color: dark.text, fontSize: 16, fontWeight: '700', marginBottom: 16 },
  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  star: { fontSize: 32, color: dark.border },
  starActive: { color: '#fbbf24' },
  input: { borderWidth: 1, borderColor: dark.border, backgroundColor: dark.surfaceElevated, color: dark.text, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, minHeight: 70, textAlignVertical: 'top' },
  error: { color: dark.danger, marginTop: 10, fontSize: 12 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelButton: { flex: 1, borderWidth: 1, borderColor: dark.border, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  cancelButtonText: { color: dark.textMuted, fontWeight: '700' },
  submitButton: { flex: 2, backgroundColor: dark.accent, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  submitButtonText: { color: '#0a0a0a', fontWeight: '700' },
});
