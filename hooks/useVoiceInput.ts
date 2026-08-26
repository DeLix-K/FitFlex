import { useCallback, useEffect, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

// Wraps expo-speech-recognition (on-device iOS/Android speech recognition,
// no cloud API/cost) into a simple "tap to speak, auto-sends on the final
// transcript" flow. Falls back to unavailable (mic button hidden entirely
// by the caller) on platforms without native speech recognition support,
// e.g. web without the optional Web Speech polyfill this library also
// offers -- not set up here since the mobile app is the real target.
export function useVoiceInput(onFinalResult: (text: string) => void) {
  const [available, setAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setAvailable(ExpoSpeechRecognitionModule.isRecognitionAvailable());
    } catch {
      setAvailable(false);
    }
  }, []);

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
    } else if (event.error !== 'no-speech') {
      setError("Didn't catch that — please try again.");
    }
  });

  const startListening = useCallback(async () => {
    setError(null);
    try {
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

  return { available, listening, interimText, error, startListening, stopListening };
}
