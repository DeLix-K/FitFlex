import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dark } from '../lib/theme';

// A muted, looping, tap-to-play/pause reel card -- used both on browse
// cards and the full trainer profile. `autoplay` starts it muted (no sound
// without an explicit tap), matching the "auto-playing, muted video cards"
// brief while never playing audio a user didn't ask for.
export default function TrainerVideoPlayer({
  uri,
  aspectRatio = 9 / 16,
  autoplay = true,
}: {
  uri: string;
  aspectRatio?: number;
  autoplay?: boolean;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    if (autoplay) p.play();
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { muted } = useEvent(player, 'mutedChange', { muted: player.muted });

  const togglePlay = () => (isPlaying ? player.pause() : player.play());
  const toggleMute = () => {
    player.muted = !player.muted;
  };

  return (
    <Pressable style={[styles.wrap, { aspectRatio }]} onPress={togglePlay}>
      <VideoView style={styles.video} player={player} nativeControls={false} contentFit="cover" />
      <View style={styles.overlayRow}>
        {!isPlaying && (
          <View style={styles.playBadge}>
            <Text style={styles.playBadgeText}>▶</Text>
          </View>
        )}
        <Pressable style={styles.muteBadge} onPress={toggleMute} hitSlop={8}>
          <Text style={styles.muteBadgeText}>{muted ? '🔇' : '🔊'}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: dark.surfaceElevated,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  overlayRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadgeText: {
    color: '#fff',
    fontSize: 20,
  },
  muteBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteBadgeText: {
    fontSize: 15,
  },
});
