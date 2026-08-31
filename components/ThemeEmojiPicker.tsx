import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { startCheckout } from '../lib/billing';
import { FREE_THEME_KEYS, PLAN_EMOJI_OPTIONS, PLAN_THEMES } from '../lib/plans';
import { dark } from '../lib/theme';
import type { PlanThemeKey } from '../lib/types';

export default function ThemeEmojiPicker({
  themeKey,
  emoji,
  isPremium,
  onChangeTheme,
  onChangeEmoji,
}: {
  themeKey: PlanThemeKey;
  emoji: string | null;
  isPremium: boolean;
  onChangeTheme: (key: PlanThemeKey) => void;
  onChangeEmoji: (emoji: string) => void;
}) {
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await startCheckout();
    } finally {
      setUpgrading(false);
    }
  };

  const handlePressTheme = (key: PlanThemeKey) => {
    const locked = !isPremium && !FREE_THEME_KEYS.includes(key);
    if (locked) {
      handleUpgrade();
      return;
    }
    onChangeTheme(key);
  };

  return (
    <View>
      <Text style={styles.label}>Theme</Text>
      <View style={styles.row}>
        {(Object.keys(PLAN_THEMES) as PlanThemeKey[]).map((key) => {
          const theme = PLAN_THEMES[key];
          const active = themeKey === key;
          const locked = !isPremium && !FREE_THEME_KEYS.includes(key);
          return (
            <Pressable
              key={key}
              style={[styles.swatch, { backgroundColor: theme.accent }, active && styles.swatchActive]}
              onPress={() => handlePressTheme(key)}
              disabled={upgrading}
            >
              {locked ? (
                <Text style={styles.lock}>🔒</Text>
              ) : active ? (
                <Text style={styles.check}>✓</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {!isPremium && (
        <Pressable style={styles.unlockButton} onPress={handleUpgrade} disabled={upgrading}>
          {upgrading ? (
            <ActivityIndicator color="#0a0a0a" size="small" />
          ) : (
            <Text style={styles.unlockButtonText}>🔒 Unlock Gold, Crimson & Azure with Premium</Text>
          )}
        </Pressable>
      )}

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
  lock: {
    fontSize: 13,
  },
  unlockButton: {
    backgroundColor: dark.accent,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  unlockButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
    fontSize: 12,
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
