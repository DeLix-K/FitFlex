import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import SegmentedHeader from '../components/SegmentedHeader';
import { dark } from '../lib/theme';
import HabitsScreen from './HabitsScreen';
import SleepScreen from './SleepScreen';
import WellnessScreen from './WellnessScreen';

type Segment = 'checkin' | 'sleep' | 'habits';

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'checkin', label: '🙂 Check-in' },
  { value: 'sleep', label: '😴 Sleep' },
  { value: 'habits', label: '✅ Habits' },
];

// Sleep, mood/stress check-ins, and habit tracking are all "how am I doing
// today" screens -- merged under one Wellness tab, same segmented-header
// pattern as the other consolidated tabs.
export default function WellnessHubScreen() {
  const [segment, setSegment] = useState<Segment>('checkin');

  return (
    <View style={styles.container}>
      <SegmentedHeader segments={SEGMENTS} active={segment} onChange={setSegment} />
      <View style={styles.body}>
        {segment === 'checkin' && <WellnessScreen />}
        {segment === 'sleep' && <SleepScreen />}
        {segment === 'habits' && <HabitsScreen />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.background },
  body: { flex: 1 },
});
