import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';

// Web target for YouTubeEmbed.tsx -- a real <iframe> via createElement (not
// JSX) since react-native-web has no 'iframe' host component and this file
// is never bundled for native, where <iframe> wouldn't resolve at all.
export default function YouTubeEmbed({ videoId, aspectRatio = 16 / 9 }: { videoId: string; aspectRatio?: number }) {
  return (
    <View style={[styles.wrap, { aspectRatio }]}>
      {createElement('iframe', {
        src: `https://www.youtube.com/embed/${videoId}`,
        style: { width: '100%', height: '100%', border: 0, display: 'block' },
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowFullScreen: true,
        title: 'YouTube video player',
      })}
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
});
