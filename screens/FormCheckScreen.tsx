import PhotoScanScreen from '../components/PhotoScanScreen';
import { FORM_CHECK_PROMPT } from '../lib/claude';

export default function FormCheckScreen({ onBack }: { onBack?: () => void }) {
  return (
    <PhotoScanScreen
      title="Form Check"
      subtitle="Take or choose a photo of yourself mid-rep to get feedback on your form."
      prompt={FORM_CHECK_PROMPT}
      loadingLabel="Analyzing your form..."
      historyKind="form_check"
      backLabel="Coach"
      onBack={onBack}
    />
  );
}
