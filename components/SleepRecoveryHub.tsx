import { StyleSheet, Text, View } from 'react-native';
import { dark } from '../lib/theme';
import SleepAmbientNoise from './SleepAmbientNoise';
import SleepBedtimeStory from './SleepBedtimeStory';
import SleepBreathwork from './SleepBreathwork';
import SleepMobilityFlow from './SleepMobilityFlow';
import SleepSmartAlarm from './SleepSmartAlarm';

export default function SleepRecoveryHub() {
  return (
    <View>
      <Text style={styles.sectionTitle}>Recovery Hub</Text>
      <SleepSmartAlarm />
      <SleepAmbientNoise />
      <SleepBedtimeStory />
      <SleepBreathwork />
      <SleepMobilityFlow />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: dark.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
});
