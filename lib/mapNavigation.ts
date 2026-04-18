import { LatLng, sanitizeLngLatTuple } from "@/lib/mapSafety";

export type MapboxDirectionsProfile = "driving" | "driving-traffic";
export type LngLatTuple = [number, number];

export interface MapboxNavigationStep {
  index: number;
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  location?: LngLatTuple;
  maneuverType?: string;
  maneuverModifier?: string;
}

export interface MapboxNavigationRoute {
  coordinates: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
  steps: MapboxNavigationStep[];
  fetchedAt: number;
}

const EARTH_RADIUS_METERS = 6371000;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function normalizeMapboxToken(): string {
  return String(
    process.env.EXPO_PUBLIC_MAPBOX_TOKEN ||
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
      "",
  ).trim();
}

function toWaypoint(tuple: LngLatTuple): string {
  return `${tuple[0]},${tuple[1]}`;
}

export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_METERS * c;
}

export function nearestDistanceToRouteMeters(
  point: LatLng,
  routeCoordinates: LatLng[],
): number {
  if (!routeCoordinates.length) return Number.POSITIVE_INFINITY;

  let minDistance = Number.POSITIVE_INFINITY;
  for (const coordinate of routeCoordinates) {
    const distance = haversineDistanceMeters(point, coordinate);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return minDistance;
}

export function findNearestStepIndex(
  point: LatLng,
  steps: MapboxNavigationStep[],
  currentIndex: number,
): number {
  if (!steps.length) return 0;

  const start = Math.max(0, currentIndex);
  const end = Math.min(steps.length - 1, start + 8);

  let nearestIndex = start;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let i = start; i <= end; i += 1) {
    const stepLocation = steps[i]?.location;
    if (!stepLocation) continue;

    const distance = haversineDistanceMeters(point, {
      latitude: stepLocation[1],
      longitude: stepLocation[0],
    });

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = i;
    }
  }

  if (nearestDistance < 80) {
    return nearestIndex;
  }

  return currentIndex;
}

export function getRemainingStepDistanceMeters(
  steps: MapboxNavigationStep[],
  stepIndex: number,
): number {
  return steps
    .slice(Math.max(0, stepIndex))
    .reduce((acc, step) => acc + (step.distanceMeters || 0), 0);
}

export function getRemainingStepDurationSeconds(
  steps: MapboxNavigationStep[],
  stepIndex: number,
): number {
  return steps
    .slice(Math.max(0, stepIndex))
    .reduce((acc, step) => acc + (step.durationSeconds || 0), 0);
}

export async function fetchMapboxNavigationRoute(options: {
  origin: LngLatTuple;
  destination: LngLatTuple;
  profile?: MapboxDirectionsProfile;
}): Promise<MapboxNavigationRoute> {
  const token = normalizeMapboxToken();
  if (!token) {
    throw new Error("mapbox-token-missing");
  }

  const profile = options.profile || "driving-traffic";
  const coordinates = `${toWaypoint(options.origin)};${toWaypoint(options.destination)}`;

  const params = new URLSearchParams({
    alternatives: "false",
    geometries: "geojson",
    overview: "full",
    steps: "true",
    voice_instructions: "false",
    banner_instructions: "false",
    access_token: token,
  });

  const response = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?${params.toString()}`,
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.message || "mapbox-directions-request-failed");
  }

  const primaryRoute = payload?.routes?.[0];
  if (!primaryRoute) {
    throw new Error("mapbox-directions-no-route");
  }

  const parsedCoordinates = Array.isArray(primaryRoute?.geometry?.coordinates)
    ? primaryRoute.geometry.coordinates
        .map((point: unknown) => sanitizeLngLatTuple(point))
        .filter((point: LngLatTuple | null): point is LngLatTuple =>
          Boolean(point),
        )
        .map(([longitude, latitude]) => ({ longitude, latitude }))
    : [];

  let runningIndex = 0;
  const parsedSteps: MapboxNavigationStep[] = Array.isArray(primaryRoute?.legs)
    ? primaryRoute.legs.flatMap((leg: any) => {
        const legSteps = Array.isArray(leg?.steps) ? leg.steps : [];
        return legSteps.map((step: any) => {
          const instruction =
            String(step?.maneuver?.instruction || "").trim() ||
            String(step?.name || "").trim() ||
            "Continue straight";
          const location = sanitizeLngLatTuple(step?.maneuver?.location);

          const parsed: MapboxNavigationStep = {
            index: runningIndex,
            instruction,
            distanceMeters: Number(step?.distance || 0),
            durationSeconds: Number(step?.duration || 0),
            maneuverType:
              typeof step?.maneuver?.type === "string"
                ? step.maneuver.type
                : undefined,
            maneuverModifier:
              typeof step?.maneuver?.modifier === "string"
                ? step.maneuver.modifier
                : undefined,
          };

          if (location) {
            parsed.location = location;
          }

          runningIndex += 1;
          return parsed;
        });
      })
    : [];

  return {
    coordinates: parsedCoordinates,
    distanceMeters: Number(primaryRoute?.distance || 0),
    durationSeconds: Number(primaryRoute?.duration || 0),
    steps: parsedSteps,
    fetchedAt: Date.now(),
  };
}
