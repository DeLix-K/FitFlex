import { supabase } from './supabase';
import type { OutdoorActivity, OutdoorActivityType, RoutePoint } from './types';

// Haversine distance between two lat/lng points, in meters. Pure math, no
// API/vendor needed -- this is why distance/pace tracking works on both
// platforms even though the live map view (react-native-maps) is iOS-only
// for now.
function haversineMeters(a: RoutePoint, b: RoutePoint): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function computeRouteDistanceMeters(route: RoutePoint[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    total += haversineMeters(route[i - 1], route[i]);
  }
  return total;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Pace as minutes per km. Returns null when there's not enough real distance
// yet to give a meaningful number, rather than showing an inflated/infinite
// pace from a few noisy GPS points.
export function formatPace(meters: number, seconds: number): string | null {
  if (meters < 50 || seconds < 20) return null;
  const km = meters / 1000;
  const minutes = seconds / 60;
  const paceMinPerKm = minutes / km;
  const paceMin = Math.floor(paceMinPerKm);
  const paceSec = Math.round((paceMinPerKm - paceMin) * 60);
  return `${paceMin}:${String(paceSec).padStart(2, '0')} /km`;
}

export async function saveOutdoorActivity(params: {
  activityType: OutdoorActivityType;
  startedAt: string;
  endedAt: string;
  distanceMeters: number;
  durationSeconds: number;
  route: RoutePoint[];
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in.');

  const { error } = await supabase.from('outdoor_activities').insert({
    user_id: userId,
    activity_type: params.activityType,
    started_at: params.startedAt,
    ended_at: params.endedAt,
    distance_meters: params.distanceMeters,
    duration_seconds: params.durationSeconds,
    route: params.route,
  });
  if (error) throw new Error(error.message);
}

export async function fetchMyOutdoorActivities(): Promise<OutdoorActivity[]> {
  const { data, error } = await supabase
    .from('outdoor_activities')
    .select('*')
    .order('started_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function deleteOutdoorActivity(id: string): Promise<void> {
  const { error } = await supabase.from('outdoor_activities').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
