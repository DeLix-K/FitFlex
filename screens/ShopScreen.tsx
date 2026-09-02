import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import SegmentedHeader from '../components/SegmentedHeader';
import { dark } from '../lib/theme';
import CoursesScreen from './CoursesScreen';
import DigitalProductsScreen from './DigitalProductsScreen';
import MerchScreen from './MerchScreen';
import TrainersScreen from './TrainersScreen';

type Segment = 'trainers' | 'courses' | 'guides' | 'merch';

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'trainers', label: '🧑‍🏫 Trainers' },
  { value: 'courses', label: '📚 Courses' },
  { value: 'guides', label: '📄 Guides & Plans' },
  { value: 'merch', label: '👕 Merch' },
];

// Trainers, Courses, Guides & Plans, and Merch are all "buy something"
// marketplace experiences -- merged under one Shop tab.
export default function ShopScreen() {
  const [segment, setSegment] = useState<Segment>('trainers');

  return (
    <View style={styles.container}>
      <SegmentedHeader segments={SEGMENTS} active={segment} onChange={setSegment} />
      <View style={styles.body}>
        {segment === 'trainers' && <TrainersScreen />}
        {segment === 'courses' && <CoursesScreen />}
        {segment === 'guides' && <DigitalProductsScreen />}
        {segment === 'merch' && <MerchScreen />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dark.background },
  body: { flex: 1 },
});
