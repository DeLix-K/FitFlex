import PhotoScanScreen from '../components/PhotoScanScreen';
import { FOOD_SCAN_PROMPT } from '../lib/claude';

export default function FoodScanScreen() {
  return (
    <PhotoScanScreen
      title="Scan Food"
      subtitle="Take or choose a photo of a meal or snack to get an estimated calorie and macro breakdown."
      prompt={FOOD_SCAN_PROMPT}
      loadingLabel="Analyzing food..."
      historyKind="food_scan"
    />
  );
}
