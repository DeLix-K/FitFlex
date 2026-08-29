import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { startCheckout } from '../lib/billing';
import { calm } from '../lib/theme';

// All three tracks are pure sine-wave binaural beats synthesized by
// scripts/generate_binaural_beats.js (a distinct left/right frequency per
// track) -- no licensed audio. Framed factually (frequency ranges commonly
// associated with a mental state) rather than as a clinical claim.
const TRACKS = [
  {
    key: 'focus',
    label: 'Focus',
    emoji: '🎯',
    sub: '~14Hz (Beta)',
    asset: require('../assets/audio/binaural_focus.wav'),
  },
  {
    key: 'relax',
    label: 'Relax',
    emoji: '🌊',
    sub: '~8Hz (Alpha)',
    asset: require('../assets/audio/binaural_relax.wav'),
  },
  {
    key: 'sleep',
    label: 'Deep Sleep',
    emoji: '🌙',
    sub: '~3Hz (Delta)',
    asset: require('../assets/audio/binaural_sleep.wav'),
  },
] as const;

type TrackKey = (typeof TRACKS)[number]['key'];

function TrackButton({
  label,
  emoji,
  sub,
  asset,
  activeKey,
  myKey,
  onPlayingChange,
}: {
  label: string;
  emoji: string;
  sub: string;
  asset: number;
  activeKey: TrackKey | null;
  myKey: TrackKey;
  onPlayingChange: (key: TrackKey, playing: boolean) => void;
}) {
  const player = useAudioPlayer(asset);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    player.loop = true;
  }, [player]);

  useEffect(() => {
    if (activeKey !== myKey && status.playing) {
      player.pause();
      player.seekTo(0);
    }
  }, [activeKey, myKey, player, status.playing]);

  const toggle = () => {
    if (status.playing) {
      player.pause();
      onPlayingChange(myKey, false);
    } else {
      player.play();
      onPlayingChange(myKey, true);
    }
  };

  const isActive = activeKey === myKey && status.playing;

  return (
    <Pressable style={[styles.trackButton, isActive && styles.trackButtonActive]} onPress={toggle}>
      <Text style={styles.trackEmoji}>{emoji}</Text>
      <Text style={[styles.trackLabel, isActive && styles.trackLabelActive]}>{label}</Text>
      <Text style={styles.trackSub}>{sub}</Text>
      <Text style={styles.trackState}>{isActive ? '⏸ Playing' : '▶ Play'}</Text>
    </Pressable>
  );
}

export default function BinauralBeatsLibrary({ isPremium }: { isPremium: boolean }) {
  const [activeKey, setActiveKey] = useState<TrackKey | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await startCheckout();
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>🎧 Soundscapes & Binaural Beats</Text>
      <Text style={styles.hint}>
        Frequency-based audio — each track pairs a slightly different tone per ear, in the range
        commonly associated with the mood shown. Best with headphones. Not a medical treatment.
      </Text>

      {isPremium ? (
        <View style={styles.tracksRow}>
          {TRACKS.map((t) => (
            <TrackButton
              key={t.key}
              label={t.label}
              emoji={t.emoji}
              sub={t.sub}
              asset={t.asset}
              activeKey={activeKey}
              myKey={t.key}
              onPlayingChange={(key, playing) => setActiveKey(playing ? key : null)}
            />
          ))}
        </View>
      ) : (
        <Pressable style={styles.unlockButton} onPress={handleUpgrade} disabled={upgrading}>
          {upgrading ? (
            <ActivityIndicator color="#0a2420" size="small" />
          ) : (
            <Text style={styles.unlockButtonText}>🔒 Unlock Full Library with Premium</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: calm.border,
    backgroundColor: calm.surface,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  title: {
    color: calm.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  hint: {
    color: calm.textFaint,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 14,
  },
  tracksRow: {
    flexDirection: 'row',
    gap: 10,
  },
  trackButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: calm.border,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  trackButtonActive: {
    borderColor: calm.accent,
    backgroundColor: calm.surfaceElevated,
  },
  trackEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  trackLabel: {
    color: calm.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  trackLabelActive: {
    color: calm.accent,
  },
  trackSub: {
    color: calm.textFaint,
    fontSize: 10,
    marginTop: 2,
  },
  trackState: {
    color: calm.textFaint,
    fontSize: 10,
    marginTop: 6,
  },
  unlockButton: {
    backgroundColor: calm.accent,
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
  },
  unlockButtonText: {
    color: '#0a2420',
    fontWeight: '700',
    fontSize: 13,
  },
});
