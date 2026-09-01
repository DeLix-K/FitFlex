import { StyleSheet, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { dark } from '../lib/theme';
import type { RoutePoint } from '../lib/types';

// iOS-only: real Apple Maps rendering (default provider, no API key needed).
// Only this file imports react-native-maps -- see RouteMap.tsx for why.
export default function RouteMap({ route }: { route: RoutePoint[] }) {
  const last = route[route.length - 1];
  const coordinates = route.map((p) => ({ latitude: p.lat, longitude: p.lng }));

  return (
    <View style={styles.wrap}>
      <MapView
        style={styles.map}
        region={
          last
            ? { latitude: last.lat, longitude: last.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 }
            : undefined
        }
        showsUserLocation
      >
        {coordinates.length > 1 && <Polyline coordinates={coordinates} strokeColor={dark.accent} strokeWidth={4} />}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 220, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: dark.border },
  map: { flex: 1 },
});
