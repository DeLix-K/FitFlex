import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PLAN_EMOJI_OPTIONS, PLAN_THEMES } from '../lib/plans';
import { dark } from '../lib/theme';
import type { PlanThemeKey } from '../lib/types';

export default function ThemeEmojiPicker({
  themeKey,
  emoji,
  onChangeTheme,
  onChangeEmoji,
}: {
  themeKey: PlanThemeKey;
  emoji: string | null;
  onChangeTheme: (key: PlanThemeKey) => void;
  onChangeEmoji: (emoji: string) => void;
}) {
  return (
    <View>
      <Text style={styles.label}>Theme</Text>
      <View style={styles.row}>
        {(Object.keys(PLAN_THEMES) as PlanThemeKey[]).map((key) => {
          const theme = PLAN_THEMES[key];
          const active = themeKey === key;
          return (
            <Pressable
              key={key}
              style={[
                styles.swatch,
                { backgroundColor: theme.accent },
                active && styles.swatchActive,
              ]}
              onPress={() => onChangeTheme(key)}
            >
              {active && <Text style={styles.check}>✓</Text>}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Cover emoji</Text>
      <View style={styles.row}>
        {PLAN_EMOJI_OPTIONS.map((e) => (
          <Pressable
            key={e}
            style={[styles.emojiChip, emoji === e && styles.emojiChipActive]}
            onPress={() => onChangeEmoji(e)}
          >
            <Text style={styles.emojiChipText}>{e}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: dark.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchActive: {
    borderWidth: 3,
    borderColor: dark.text,
  },
  check: {
    color: '#0a0a0a',
    fontWeight: '900',
  },
  emojiChip: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiChipActive: {
    borderColor: dark.accent,
    backgroundColor: dark.surfaceElevated,
  },
  emojiChipText: {
    fontSize: 20,
  },
});
