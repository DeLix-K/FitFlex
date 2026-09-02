import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import SegmentedHeader from '../components/SegmentedHeader';
import { dark } from '../lib/theme';
import ChallengesScreen from './ChallengesScreen';
import StreaksScreen from './StreaksScreen';

type Segment = 'streaks' | 'challenges';

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'streaks', label: '🔥 Streaks' },
  { value: 'challenges', label: '🏆 Challenges' },
];

// Streaks and Challenges are both motivation/gamification -- merged under
// one Progress tab.
export default function ProgressScreen() {
  const [segment, setSegment] = useState<Segment>('streaks');

  return (
    <View style={styles.container}>
      <SegmentedHeader segments={SEGMENTS} active={segment} onChange={setSegment} />
      <View style={styles.body}>{segment === 'streaks' ? <StreaksScreen /> : <ChallengesScreen />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.background },
  body: { flex: 1 },
});
