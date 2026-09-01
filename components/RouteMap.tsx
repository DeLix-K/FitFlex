import { StyleSheet, Text, View } from 'react-native';
import { dark } from '../lib/theme';
import type { RoutePoint } from '../lib/types';

// Android/web fallback -- deliberately never imports react-native-maps here,
// so the Android JS bundle has zero reference to it (belt-and-suspenders on
// top of the package.json autolinking exclude, which has a known open bug:
// https://github.com/expo/expo/issues/38169). Real Apple Maps rendering
// lives in RouteMap.ios.tsx; Metro picks the right one per platform
// automatically via the filename convention.
export default function RouteMap({ route }: { route: RoutePoint[] }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.text}>
        🗺️ Live map view isn't available on this platform yet — your route is still being tracked and saved.
      </Text>
      {route.length > 0 && <Text style={styles.pointCount}>{route.length} GPS points recorded so far</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    height: 180,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  text: { color: dark.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  pointCount: { color: dark.textFaint, fontSize: 11, marginTop: 8 },
});
