import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dark } from '../lib/theme';

// Fixed editorial content, same spirit as the Exercises library's static
// instructions -- a genuine general-purpose routine, not personalized or
// AI-generated, and not claimed to be either.
const ROUTINE = [
  { name: "Child's Pose", duration: '60s', instructions: 'Kneel, sit back on your heels, reach arms forward, and breathe slowly.' },
  { name: 'Seated Forward Fold', duration: '60s', instructions: 'Sit with legs extended, hinge at the hips, and let your head relax down.' },
  { name: 'Supine Spinal Twist', duration: '45s / side', instructions: 'Lie on your back, drop both knees to one side, and turn your gaze the other way.' },
  { name: "Figure-4 Stretch", duration: '45s / side', instructions: 'Lying down, cross one ankle over the opposite knee and gently pull the leg in.' },
  { name: 'Legs-Up-the-Wall', duration: '2-3 min', instructions: 'Lie on your back with legs resting up a wall, arms relaxed at your sides.' },
];

export default function SleepMobilityFlow() {
  const [done, setDone] = useState<boolean[]>(() => ROUTINE.map(() => false));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🧘‍♀️ Pre-Bed Mobility Flow</Text>
      <Text style={styles.hint}>A gentle general routine — about 6 minutes total.</Text>
      {ROUTINE.map((step, i) => (
        <Pressable
          key={step.name}
          style={styles.row}
          onPress={() => setDone((d) => d.map((v, idx) => (idx === i ? !v : v)))}
        >
          <View style={[styles.checkbox, done[i] && styles.checkboxChecked]}>
            {done[i] && <Text style={styles.checkboxMark}>✓</Text>}
          </View>
          <View style={styles.rowText}>
            <View style={styles.rowHeader}>
              <Text style={[styles.stepName, done[i] && styles.stepDone]}>{step.name}</Text>
              <Text style={styles.stepDuration}>{step.duration}</Text>
            </View>
            <Text style={styles.stepInstructions}>{step.instructions}</Text>
          </View>
        </Pressable>
      ))}
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
    marginBottom: 12,
  },
  title: {
    color: dark.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  hint: {
    color: dark.textFaint,
    fontSize: 11,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: dark.border,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: dark.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: dark.accent,
    borderColor: dark.accent,
  },
  checkboxMark: {
    color: '#0a0a0a',
    fontSize: 12,
    fontWeight: '800',
  },
  rowText: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepName: {
    color: dark.text,
    fontSize: 13,
    fontWeight: '700',
  },
  stepDone: {
    color: dark.textFaint,
    textDecorationLine: 'line-through',
  },
  stepDuration: {
    color: dark.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  stepInstructions: {
    color: dark.textMuted,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
});
