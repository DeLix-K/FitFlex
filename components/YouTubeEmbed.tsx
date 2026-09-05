import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

// Native (iOS/Android) YouTube embed -- the metro bundler picks this file for
// native builds and YouTubeEmbed.web.tsx for web, since react-native-webview
// doesn't ship a usable web target and a real <iframe> isn't a valid native
// host component.
export default function YouTubeEmbed({ videoId, aspectRatio = 16 / 9 }: { videoId: string; aspectRatio?: number }) {
  return (
    <View style={[styles.wrap, { aspectRatio }]}>
      <WebView
        source={{ uri: `https://www.youtube.com/embed/${videoId}?playsinline=1` }}
        style={styles.video}
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
    backgroundColor: '#000',
  },
});
