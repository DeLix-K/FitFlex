import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { submitTrainerProfile } from '../lib/trainerDashboard';
import { FORMAT_OPTIONS, VIBE_OPTIONS } from '../lib/trainerMatchmaker';
import { uploadTrainerVideo } from '../lib/trainers';
import { dark } from '../lib/theme';
import type { CoachingStyle, TrainerProfile, TrainingFormat } from '../lib/types';
import TrainerVideoPlayer from './TrainerVideoPlayer';

const SPECIALTIES = ['Online', 'Local', 'Strength', 'Weight Loss', "Women's Fitness", 'Bodybuilding', 'Running'];

export default function TrainerProfileForm({
  existing,
  onSaved,
  onCancel,
}: {
  existing: TrainerProfile | null;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [displayName, setDisplayName] = useState(existing?.display_name ?? '');
  const [specialty, setSpecialty] = useState(existing?.specialty ?? '');
  const [bio, setBio] = useState(existing?.bio ?? '');
  const [price, setPrice] = useState(existing ? String(existing.price_cents / 100) : '');
  const [format, setFormat] = useState<TrainingFormat[]>(existing?.training_format ?? []);
  const [locationText, setLocationText] = useState(existing?.location_text ?? '');
  const [coachingStyle, setCoachingStyle] = useState<CoachingStyle | null>(existing?.coaching_style ?? null);
  const [callLink, setCallLink] = useState(existing?.default_video_call_link ?? '');
  const [videoUrl, setVideoUrl] = useState<string | null>(existing?.intro_video_url ?? null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFormat = (key: TrainingFormat) => {
    setFormat((current) => (current.includes(key) ? current.filter((f) => f !== key) : [...current, key]));
  };

  const pickVideo = async (source: 'camera' | 'library') => {
    setError(null);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError('Camera access is needed to record a video. Enable it in Settings, or choose from your library instead.');
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['videos'], videoMaxDuration: 30, quality: 0.6 };
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      setUploadingVideo(true);
      const url = await uploadTrainerVideo(asset.uri, asset.mimeType ?? 'video/mp4');
      setVideoUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    const priceCents = Math.round(Number(price) * 100);

    if (!displayName.trim()) {
      setError('Enter a display name.');
      return;
    }
    if (!price || !Number.isFinite(priceCents) || priceCents < 100) {
      setError('Enter a price of at least $1.');
      return;
    }

    setSaving(true);
    try {
      await submitTrainerProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        specialty: specialty.trim(),
        priceCents,
        introVideoUrl: videoUrl,
        trainingFormat: format,
        locationText: format.includes('in_person') ? locationText.trim() : '',
        defaultVideoCallLink: callLink.trim() || null,
        coachingStyle,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.label}>Coaching Reel (15-30s intro video)</Text>
      {videoUrl && <TrainerVideoPlayer uri={videoUrl} aspectRatio={16 / 10} autoplay={false} />}
      <View style={styles.videoButtonRow}>
        <Pressable style={styles.videoButton} onPress={() => pickVideo('camera')} disabled={uploadingVideo}>
          <Text style={styles.videoButtonText}>Record Video</Text>
        </Pressable>
        <Pressable style={styles.videoButton} onPress={() => pickVideo('library')} disabled={uploadingVideo}>
          <Text style={styles.videoButtonText}>Choose Video</Text>
        </Pressable>
      </View>
      {uploadingVideo && (
        <View style={styles.uploadingRow}>
          <ActivityIndicator color={dark.accent} size="small" />
          <Text style={styles.uploadingText}>Uploading...</Text>
        </View>
      )}

      <Text style={styles.label}>Display Name</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Your name"
        placeholderTextColor={dark.textFaint}
      />

      <Text style={styles.label}>Specialty</Text>
      <View style={styles.chipRow}>
        {SPECIALTIES.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, specialty === s && styles.chipActive]}
            onPress={() => setSpecialty(s)}
          >
            <Text style={[styles.chipText, specialty === s && styles.chipTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={specialty}
        onChangeText={setSpecialty}
        placeholder="Or type your own specialty"
        placeholderTextColor={dark.textFaint}
      />

      <Text style={styles.label}>Training Format (select all that apply)</Text>
      <View style={styles.chipRow}>
        {FORMAT_OPTIONS.map((f) => (
          <Pressable key={f.key} style={[styles.chip, format.includes(f.key) && styles.chipActive]} onPress={() => toggleFormat(f.key)}>
            <Text style={[styles.chipText, format.includes(f.key) && styles.chipTextActive]}>
              {f.icon} {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {format.includes('in_person') && (
        <>
          <Text style={styles.label}>Location (city/area)</Text>
          <TextInput
            style={styles.input}
            value={locationText}
            onChangeText={setLocationText}
            placeholder="e.g. Austin, TX"
            placeholderTextColor={dark.textFaint}
          />
        </>
      )}

      {(format.includes('virtual') || format.includes('online')) && (
        <>
          <Text style={styles.label}>Default video call link (Zoom, Meet, etc.)</Text>
          <TextInput
            style={styles.input}
            value={callLink}
            onChangeText={setCallLink}
            placeholder="https://..."
            placeholderTextColor={dark.textFaint}
            autoCapitalize="none"
          />
        </>
      )}

      <Text style={styles.label}>Coaching Vibe</Text>
      <View style={styles.chipRow}>
        {VIBE_OPTIONS.map((v) => (
          <Pressable
            key={v.key}
            style={[styles.chip, coachingStyle === v.key && styles.chipActive]}
            onPress={() => setCoachingStyle(coachingStyle === v.key ? null : v.key)}
          >
            <Text style={[styles.chipText, coachingStyle === v.key && styles.chipTextActive]}>
              {v.icon} {v.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.bioInput]}
        value={bio}
        onChangeText={setBio}
        placeholder="Tell clients about your experience and approach"
        placeholderTextColor={dark.textFaint}
        multiline
      />

      <Text style={styles.label}>Price per Custom Plan (USD)</Text>
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={setPrice}
        placeholder="49"
        placeholderTextColor={dark.textFaint}
        keyboardType="decimal-pad"
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.buttonRow}>
        {onCancel && (
          <Pressable style={styles.cancelButton} onPress={onCancel} disabled={saving}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        )}
        <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={saving || uploadingVideo}>
          {saving ? (
            <ActivityIndicator color="#0a0a0a" />
          ) : (
            <Text style={styles.submitButtonText}>
              {existing ? 'Save Changes' : 'Become a Trainer'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surface,
    borderRadius: 16,
    padding: 16,
  },
  label: {
    fontSize: 12,
    color: dark.textMuted,
    marginBottom: 6,
    marginTop: 12,
  },
  videoButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  videoButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  videoButtonText: {
    color: dark.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  uploadingText: {
    color: dark.textMuted,
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: dark.border,
    backgroundColor: dark.surfaceElevated,
    color: dark.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  bioInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: dark.accent,
    borderColor: dark.accent,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: dark.textMuted,
  },
  chipTextActive: {
    color: '#0a0a0a',
  },
  error: {
    color: dark.danger,
    marginTop: 12,
    fontSize: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: dark.textMuted,
    fontWeight: '700',
  },
  submitButton: {
    flex: 2,
    backgroundColor: dark.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#0a0a0a',
    fontWeight: '700',
  },
});
