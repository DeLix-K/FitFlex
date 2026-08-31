import { useAudioPlayer } from 'expo-audio';
import { Pressable, StyleSheet, Text } from 'react-native';
import { dark } from '../lib/theme';

export default function AudioPlayerButton({ uri, label = '▶ Play Voice Note' }: { uri: string; label?: string }) {
  const player = useAudioPlayer(uri);

  return (
    <Pressable
      style={styles.button}
      onPress={() => {
        player.seekTo(0);
        player.play();
      }}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: dark.accent,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
  },
  text: {
    color: dark.accent,
    fontWeight: '700',
    fontSize: 12,
  },
});
