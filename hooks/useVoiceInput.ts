import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

const UNAVAILABLE_MESSAGE = Platform.select({
  ios: "Voice input needs Siri & Dictation enabled — turn it on in Settings > Siri & Search, or Settings > General > Keyboard > Enable Dictation, then try again.",
  android: 'Voice input needs a voice recognition service enabled on your device (e.g. the Google app) — check your device settings, then try again.',
  default: "Voice input isn't available on this device.",
});

// Wraps expo-speech-recognition (on-device iOS/Android speech recognition,
// also works via the browser's Web Speech API where present) into a simple
// "tap to speak, auto-sends on the final transcript" flow. The mic button
// stays visible even when recognition is currently unavailable -- tapping
// it explains why (usually a system setting, e.g. Siri & Dictation being
// off on iOS) rather than silently disappearing with no explanation.
export function useVoiceInput(onFinalResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useSpeechRecognitionEvent('start', () => {
    setListening(true);
    setError(null);
  });

  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    setInterimText('');
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    if (event.isFinal) {
      setInterimText('');
      if (transcript.trim()) onFinalResult(transcript.trim());
    } else {
      setInterimText(transcript);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    setInterimText('');
    if (event.error === 'not-allowed') {
      setError('Microphone or speech recognition permission was denied.');
    } else if (event.error === 'service-not-allowed' || event.error === 'language-not-supported') {
      setError(UNAVAILABLE_MESSAGE ?? null);
    } else if (event.error !== 'no-speech') {
      setError("Didn't catch that — please try again.");
    }
  });

  const startListening = useCallback(async () => {
    setError(null);
    try {
      let recognitionAvailable = false;
      try {
        recognitionAvailable = ExpoSpeechRecognitionModule.isRecognitionAvailable();
      } catch {
        recognitionAvailable = false;
      }
      if (!recognitionAvailable) {
        setError(UNAVAILABLE_MESSAGE ?? null);
        return;
      }

      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        setError('Microphone or speech recognition permission was denied.');
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const stopListening = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return { listening, interimText, error, startListening, stopListening };
}
