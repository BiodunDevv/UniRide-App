import Constants from "expo-constants";
import { Platform } from "react-native";

export type LngLatTuple = [number, number];
export type LatLng = { latitude: number; longitude: number };

export const DEFAULT_MAP_CENTER: LatLng = {
  latitude: 7.52,
  longitude: 4.52,
};

export const DEFAULT_MAP_CENTER_TUPLE: LngLatTuple = [
  DEFAULT_MAP_CENTER.longitude,
  DEFAULT_MAP_CENTER.latitude,
];

function normalizeCoordinate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function isValidLatitude(value: unknown): value is number {
  const latitude = normalizeCoordinate(value);
  return latitude !== null && latitude >= -90 && latitude <= 90;
}

export function isValidLongitude(value: unknown): value is number {
  const longitude = normalizeCoordinate(value);
  return longitude !== null && longitude >= -180 && longitude <= 180;
}

export function sanitizeLatLng(value: unknown): LatLng | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const latitude = normalizeCoordinate(candidate.latitude);
  const longitude = normalizeCoordinate(candidate.longitude);

  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

export function sanitizeLngLatTuple(value: unknown): LngLatTuple | null {
  if (Array.isArray(value) && value.length >= 2) {
    const longitude = normalizeCoordinate(value[0]);
    const latitude = normalizeCoordinate(value[1]);
    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      return null;
    }
    return [longitude, latitude];
  }

  const point = sanitizeLatLng(value);
  return point ? [point.longitude, point.latitude] : null;
}

export function sanitizeMapRegion(region?: {
  latitude?: unknown;
  longitude?: unknown;
  latitudeDelta?: unknown;
  longitudeDelta?: unknown;
} | null) {
  const point = sanitizeLatLng(region);
  if (!point) {
    return {
      ...DEFAULT_MAP_CENTER,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }

  const latitudeDelta = normalizeCoordinate(region?.latitudeDelta) ?? 0.02;
  const longitudeDelta = normalizeCoordinate(region?.longitudeDelta) ?? 0.02;

  return {
    latitude: point.latitude,
    longitude: point.longitude,
    latitudeDelta: latitudeDelta > 0 ? latitudeDelta : 0.02,
    longitudeDelta: longitudeDelta > 0 ? longitudeDelta : 0.02,
  };
}

export function sanitizeRouteGeometry(routeGeometry: unknown): LatLng[] {
  const candidate = routeGeometry as
    | { coordinates?: unknown[]; geometry?: { coordinates?: unknown[] } }
    | null
    | undefined;

  const points = Array.isArray(candidate?.coordinates)
    ? candidate.coordinates
    : Array.isArray(candidate?.geometry?.coordinates)
      ? candidate.geometry.coordinates
      : [];

  return points
    .map((point) => sanitizeLngLatTuple(point))
    .filter((point): point is LngLatTuple => Boolean(point))
    .map(([longitude, latitude]) => ({ latitude, longitude }));
}

export function resolveSafeCenter(
  ...candidates: Array<unknown>
): LngLatTuple {
  for (const candidate of candidates) {
    const point = sanitizeLngLatTuple(candidate);
    if (point) return point;
  }
  return DEFAULT_MAP_CENTER_TUPLE;
}

export function sanitizeHeading(value: unknown): number {
  const heading = normalizeCoordinate(value);
  if (heading === null) return 0;
  return ((heading % 360) + 360) % 360;
}

export function isGoogleMapsConfigured(): boolean {
  if (Platform.OS !== "android") return true;
  if (Constants.appOwnership === "expo") return true;
  return Boolean(Constants.expoConfig?.extra?.googleMapsConfigured);
}
