import { useEffect, useRef, useCallback, useState } from "react";
import * as Location from "expo-location";
import { Alert, Linking, Platform } from "react-native";
import { useLocationStore } from "@/store/useLocationStore";

/** Try getCurrentPositionAsync with a timeout, fall back to getLastKnownPositionAsync */
async function safeGetCurrentPosition(
  accuracy: Location.Accuracy = Location.Accuracy.Balanced,
): Promise<Location.LocationObject | null> {
  try {
    // Race against a timeout — getCurrentPositionAsync can hang on simulators
    const location = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    if (location) return location;
  } catch {
    // Silently fall through to fallback
  }

  // Fallback: last known position (instant, works even when GPS is unavailable)
  try {
    const last = await Location.getLastKnownPositionAsync();
    if (last) return last;
  } catch {
    // ignore
  }

  return null;
}

export function useLocation() {
  const { setUserLocation, setLocationPermission, userLocation } =
    useLocationStore();
  const [isRequesting, setIsRequesting] = useState(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    setIsRequesting(true);
    try {
      const { status: fgStatus } =
        await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== "granted") {
        Alert.alert(
          "Location Required",
          "UniRide needs your location to show nearby drivers and enable ride features. Please enable location access in Settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ],
        );
        setLocationPermission(false);
        setIsRequesting(false);
        return false;
      }

      setLocationPermission(true);

      // Get initial location (with fallback for simulators / cold GPS)
      const location = await safeGetCurrentPosition(Location.Accuracy.Balanced);
      if (location) {
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }

      setIsRequesting(false);
      return true;
    } catch (error) {
      console.warn("Location permission error:", error);
      setIsRequesting(false);
      return false;
    }
  }, [setUserLocation, setLocationPermission]);

  const startWatching = useCallback(async () => {
    if (watchRef.current) return;

    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") return;

      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10, // Update every 10 meters
          timeInterval: 5000, // Or every 5 seconds
        },
        (location) => {
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        },
      );
    } catch (error) {
      console.error("Location watch error:", error);
    }
  }, [setUserLocation]);

  const stopWatching = useCallback(() => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
  }, []);

  const getCurrentLocation = useCallback(async () => {
    try {
      const location = await safeGetCurrentPosition(Location.Accuracy.High);
      if (!location) return userLocation || null;
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserLocation(coords);
      return coords;
    } catch (error) {
      console.warn("Get current location error:", error);
      return userLocation || null;
    }
  }, [setUserLocation, userLocation]);

  useEffect(() => {
    return () => {
      stopWatching();
    };
  }, [stopWatching]);

  return {
    userLocation,
    isRequesting,
    requestPermission,
    startWatching,
    stopWatching,
    getCurrentLocation,
  };
}
