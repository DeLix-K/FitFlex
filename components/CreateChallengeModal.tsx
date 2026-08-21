import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { createChallenge } from '../lib/challenges';
import { dark } from '../lib/theme';

// Simple locale heuristic: US-locale devices default to pounds, everywhere
// else defaults to kilograms for the bench press template's suggested goal.
function detectWeightUnit(): 'kg' | 'lb' {
  try {
    const locale = Intl.NumberFormat().resolvedOptions().locale;
    return locale.toUpperCase().includes('US') ? 'lb' : 'kg';
  } catch {
    return 'kg';
  }
}

function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type Template = {
  key: string;
  label: string;
  title: string;
  description: string;
  days: number;
  targetWorkouts: number;
  targetNote: string;
};

function buildTemplates(): Template[] {
  const unit = detectWeightUnit();
  const benchGoal = unit === 'lb' ? '135 lb' : '60 kg';
  return [
    {
      key: 'pushups',
      label: '50 Push-Ups',
      title: '50 Push-Ups Challenge',
      description: 'Do 50 push-ups every day for the length of the challenge — break them into sets throughout the day if needed.',
      days: 7,
      targetWorkouts: 7,
      targetNote: 'Goal: 50 push-ups/day',
    },
    {
      key: 'bench',
      label: 'Bench Press Goal',
      title: 'Bench Press Goal Challenge',
      description: 'Train toward a bench press goal with a training session every day this challenge runs.',
      days: 14,
      targetWorkouts: 10,
      targetNote: `Goal: ${benchGoal} bench press`,
    },
    {
      key: 'steps',
      label: '10K Steps',
      title: '10K Steps Challenge',
      description: 'Hit 10,000 steps every day for the length of the challenge.',
      days: 14,
      targetWorkouts: 14,
      targetNote: 'Goal: 10,000 steps/day',
    },
    {
      key: 'month',
      label: '1-Month Fitness',
      title: '1-Month Fitness Challenge',
      description: 'Log a workout at least 20 times over the next 30 days.',
      days: 30,
      targetWorkouts: 20,
      targetNote: '',
    },
    {
      key: 'custom',
      label: 'Custom',
      title: '',
      description: '',
      days: 7,
      targetWorkouts: 7,
      targetNote: '',
    },
  ];
}

export default function CreateChallengeModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [templates] = useState(buildTemplates);
  const [templateKey, setTemplateKey] = useState('pushups');
  const [title, setTitle] = useState(templates[0].title);
  const [description, setDescription] = useState(templates[0].description);
  const [targetNote, setTargetNote] = useState(templates[0].targetNote);
  const [days, setDays] = useState(String(templates[0].days));
  const [targetWorkouts, setTargetWorkouts] = useState(String(templates[0].targetWorkouts));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyTemplate = (t: Template) => {
    setTemplateKey(t.key);
    setTitle(t.title);
    setDescription(t.description);
    setTargetNote(t.targetNote);
    setDays(String(t.days));
    setTargetWorkouts(String(t.targetWorkouts));
  };

  const handleCreate = async () => {
    setError(null);
    const numDays = Number(days);
    const numTarget = Number(targetWorkouts);

    if (!title.trim()) {
      setError('Give your challenge a title.');
      return;
    }
    if (!Number.isInteger(numDays) || numDays < 1 || numDays > 180) {
      setError('Duration must be between 1 and 180 days.');
      return;
    }
    if (!Number.isInteger(numTarget) || numTarget < 1 || numTarget > numDays) {
      setError('Target days must be between 1 and the challenge duration.');
      return;
    }

    setCreating(true);
    try {
      const startDate = todayLocalDate();
      const endDate = addDays(startDate, numDays - 1);
      await createChallenge({
        title: title.trim(),
        description: description.trim(),
        startDate,
        endDate,
        targetWorkouts: numTarget,
        targetNote: targetNote.trim(),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Create Challenge</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>

          <ScrollView>
            <Text style={styles.label}>Start from a template</Text>
            <View style={styles.chipRow}>
              {templates.map((t) => (
                <Pressable
                  key={t.key}
                  style={[styles.chip, templateKey === t.key && styles.chipActive]}
                  onPress={() => applyTemplate(t)}
                >
                  <Text style={[styles.chipText, templateKey === t.key && styles.chipTextActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Challenge title"
              placeholderTextColor={dark.textFaint}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="What does completing this challenge involve?"
              placeholderTextColor={dark.textFaint}
              multiline
            />

            <Text style={styles.label}>Goal note (optional, shown on the card)</Text>
            <TextInput
              style={styles.input}
              value={targetNote}
              onChangeText={setTargetNote}
              placeholder="e.g. Goal: 50 push-ups/day"
              placeholderTextColor={dark.textFaint}
            />

            <View style={styles.row}>
              <View style={styles.field}>
                <Text style={styles.label}>Duration (days)</Text>
                <TextInput
                  style={styles.input}
                  value={days}
                  onChangeText={setDays}
                  keyboardType="number-pad"
                  placeholderTextColor={dark.textFaint}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>Target days to complete</Text>
                <TextInput
                  style={styles.input}
                  value={targetWorkouts}
                  onChangeText={setTargetWorkouts}
                  keyboardType="number-pad"
                  placeholderTextColor={dark.textFaint}
                />
              </View>
            </View>
            <Text style={styles.hint}>
              Progress is tracked the same way as every other challenge: log a workout in the Streaks
              tab on a day you complete this challenge's goal.
            </Text>

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable style={styles.createButton} onPress={handleCreate} disabled={creating}>
              {creating ? (
                <ActivityIndicator color="#0a0a0a" />
              ) : (
                <Text style={styles.createButtonText}>Create Challenge</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: dark.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: dark.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: dark.text,
    fontSize: 17,
    fontWeight: '700',
  },
  close: {
    color: dark.accent,
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    color: dark.textMuted,
    marginBottom: 6,
    marginTop: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: dark.accent,
    borderColor: dark.accent,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: dark.textMuted,
  },
  chipTextActive: {
    color: '#0a0a0a',
  },
  input: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    color: dark.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  field: {
    flex: 1,
  },
  hint: {
    fontSize: 11,
    color: dark.textFaint,
    marginTop: 10,
    lineHeight: 15,
  },
  error: {
    color: dark.danger,
    marginTop: 12,
    fontSize: 12,
  },
  createButton: {
    backgroundColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 24,
  },
  createButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
});
