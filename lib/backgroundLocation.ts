import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import { Platform, AppState } from "react-native";

const BACKGROUND_LOCATION_TASK = "driver-background-location";
const DRIVER_ONLINE_KEY = "driver_online_state";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000";

// ── Background Task Definition ──────────────────────────────────────────
// Must be defined at top-level (outside of any component)
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error("Background location error:", error.message);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];
    if (!location) return;

    const { latitude, longitude } = location.coords;
    const heading = location.coords.heading ?? 0;

    try {
      const token = await SecureStore.getItemAsync("token");
      if (!token) return;

      await fetch(`${API_URL}/api/driver/location`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ latitude, longitude, heading }),
      });
    } catch (err) {
      // Non-critical — will retry on next update
    }
  }
});

// ── Request Background Permission ───────────────────────────────────────
export async function requestBackgroundLocationPermission(): Promise<boolean> {
  try {
    const { status: fgStatus } =
      await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== "granted") return false;

    // Background permission only available in standalone builds
    if (Platform.OS === "ios" || Platform.OS === "android") {
      try {
        const { status: bgStatus } =
          await Location.requestBackgroundPermissionsAsync();
        return bgStatus === "granted";
      } catch {
        // Background permissions not available in Expo Go
        console.log(
          "Background location not available (likely running in Expo Go)",
        );
        return false;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ── Start Background Location ───────────────────────────────────────────
export async function startBackgroundLocation(): Promise<boolean> {
  try {
    // Always persist online state regardless of background location support
    await SecureStore.setItemAsync(DRIVER_ONLINE_KEY, "true");

    const hasPermission = await requestBackgroundLocationPermission();
    if (!hasPermission) {
      console.log(
        "Background location permission not granted — using foreground only",
      );
      return false;
    }

    // Check if already running
    const isActive = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (isActive) return true;

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 10000,
      distanceInterval: 20,
      deferredUpdatesInterval: 10000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "UniRide Driver Active",
        notificationBody:
          "You're online and visible to passengers. Tap to open.",
        notificationColor: "#042F40",
      },
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
    });

    return true;
  } catch (err) {
    console.log("Background location not supported in this environment:", err);
    // Still persisted online state above, foreground interval will work
    return false;
  }
}

// ── Stop Background Location ────────────────────────────────────────────
export async function stopBackgroundLocation(): Promise<void> {
  try {
    const isActive = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
    if (isActive) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch {
    // May not have been started
  }

  await SecureStore.deleteItemAsync(DRIVER_ONLINE_KEY);
}

// ── Check Persisted Online State ────────────────────────────────────────
export async function wasDriverOnline(): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync(DRIVER_ONLINE_KEY);
    return val === "true";
  } catch {
    return false;
  }
}

// ── Check if Background Location Is Running ─────────────────────────────
export async function isBackgroundLocationActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
    );
  } catch {
    return false;
  }
}
