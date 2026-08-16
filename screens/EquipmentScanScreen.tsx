import PhotoScanScreen from '../components/PhotoScanScreen';
import { EQUIPMENT_SCAN_PROMPT } from '../lib/claude';

export default function EquipmentScanScreen() {
  return (
    <PhotoScanScreen
      title="Scan Equipment"
      subtitle="Take or choose a photo of gym equipment to find out what it is and how to use it."
      prompt={EQUIPMENT_SCAN_PROMPT}
      loadingLabel="Identifying equipment..."
      historyKind="equipment_scan"
    />
  );
}
