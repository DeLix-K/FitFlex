import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { dark } from '../lib/theme';

// Shared "poster" empty state: a real photo with a dark gradient fade into
// readable text at the bottom, instead of a bare line of gray text. Used
// wherever a screen has a genuine first-time-empty moment worth making
// inviting rather than blank.
export default function EmptyStateCard({
  image,
  title,
  subtitle,
}: {
  image: number;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.card}>
      <ImageBackground source={image} style={styles.image} resizeMode="cover">
        <LinearGradient
          colors={['transparent', 'rgba(10,10,10,0.55)', dark.background]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.textWrap}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: dark.border,
    marginVertical: 8,
  },
  image: {
    width: '100%',
    height: 220,
    justifyContent: 'flex-end',
  },
  textWrap: {
    padding: 16,
  },
  title: {
    color: dark.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: dark.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
