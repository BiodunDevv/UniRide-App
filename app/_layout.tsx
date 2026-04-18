import "react-native-reanimated";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { Platform, View, AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import {
  MapProviderProvider,
  useMapProvider,
  isMapboxAvailable,
  isNativeMapsAvailable,
} from "@/components/map/ExpoMap";
import { usePlatformSettingsStore } from "@/store/usePlatformSettingsStore";
import { useAuthStore } from "@/store/useAuthStore";
import Constants from "expo-constants";
import { isGoogleMapsConfigured } from "@/lib/mapSafety";
import { recordBootstrapTrace } from "@/lib/post-auth";

// Prevent the native splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

const screenTransition = Platform.select({
  ios: {
    animation: "ios_from_right" as const,
    animationDuration: 350,
  },
  android: {
    animation: "simple_push" as const,
    animationDuration: 260,
  },
});

const modalTransition = Platform.select({
  ios: "slide_from_bottom" as const,
  android: "fade_from_bottom" as const,
  default: "fade_from_bottom" as const,
});

function PlatformSettingsLoader() {
  const {
    setMapsEnabled,
    setProviderEnabled,
    setProvider,
    setMap3dEnabled,
    setNavigationEnabled,
    setNativeModuleAvailable,
  } = useMapProvider();
  const router = useRouter();
  const segments = useSegments();
  const fetchSettings = usePlatformSettingsStore((s) => s.fetchSettings);
  const settings = usePlatformSettingsStore((s) => s.settings);
  const hasLoaded = useRef(false);
  const rootSegment = segments[0] || null;

  // Fetch settings on mount, poll every 60s, and re-fetch on app foreground
  useEffect(() => {
    fetchSettings().then(() => {
      hasLoaded.current = true;
    });
    const iv = setInterval(fetchSettings, 60000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        fetchSettings();
        // Re-validate token when app comes to foreground
        const { token, fetchMe } = useAuthStore.getState();
        if (token) fetchMe().catch(() => {});
      }
    });
    return () => {
      clearInterval(iv);
      sub.remove();
    };
  }, [fetchSettings]);

  // Keep map availability and provider mode in sync with backend settings
  useEffect(() => {
    const mobileMapEnabled =
      settings.mobile_map_enabled ?? settings.expo_maps_enabled;
    const provider =
      settings.mobile_map_provider === "mapbox" ? "mapbox" : "native";
    const nativeProviderReady =
      isNativeMapsAvailable && isGoogleMapsConfigured();

    setMapsEnabled(Boolean(mobileMapEnabled));
    setProviderEnabled(Boolean(mobileMapEnabled));
    setProvider(provider);
    setMap3dEnabled(Boolean(settings.mobile_map_3d_enabled));
    setNavigationEnabled(Boolean(settings.mobile_navigation_enabled));
    setNativeModuleAvailable(nativeProviderReady);

    if (mobileMapEnabled && provider === "mapbox" && !isMapboxAvailable) {
      recordBootstrapTrace(
        "maps:provider-fallback",
        "mapbox-unavailable-native-fallback",
      ).catch(() => {});
    }

    if (mobileMapEnabled && provider === "native" && !nativeProviderReady) {
      recordBootstrapTrace(
        "maps:disabled",
        isNativeMapsAvailable
          ? "android-provider-not-configured"
          : "native-map-module-unavailable",
      ).catch(() => {});
    }
  }, [
    settings.expo_maps_enabled,
    settings.mobile_map_3d_enabled,
    settings.mobile_map_enabled,
    settings.mobile_map_provider,
    settings.mobile_navigation_enabled,
    setMapsEnabled,
    setProviderEnabled,
    setProvider,
    setMap3dEnabled,
    setNavigationEnabled,
    setNativeModuleAvailable,
  ]);

  // Gate: redirect to maintenance screen when maintenance_mode is on or app version is too old
  useEffect(() => {
    if (!hasLoaded.current) return;
    const onMaintenance = rootSegment === "maintenance";
    const appVersion = Constants.expoConfig?.version || "1.0.0";
    const needsUpdate =
      compareVersions(appVersion, settings.app_version_minimum) < 0;
    const shouldBlock = settings.maintenance_mode || needsUpdate;

    if (shouldBlock && !onMaintenance) {
      router.replace("/maintenance");
    } else if (!shouldBlock && onMaintenance) {
      router.replace("/");
    }
  }, [
    rootSegment,
    router,
    settings.maintenance_mode,
    settings.app_version_minimum,
  ]);

  return null;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

function PushNotificationsGate() {
  usePushNotifications(true);
  return null;
}

export default function RootLayout() {
  useEffect(() => {
    // Hide native splash once our custom one renders
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <MapProviderProvider>
        <PushNotificationsGate />
        <PlatformSettingsLoader />
        <View style={{ flex: 1 }}>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              ...screenTransition,
              gestureEnabled: true,
              gestureDirection: "horizontal",
            }}
          >
            <Stack.Screen name="index" options={{ animation: "none" }} />
            <Stack.Screen
              name="maintenance"
              options={{ animation: "fade", gestureEnabled: false }}
            />
            <Stack.Screen name="welcome" options={{ animation: "fade" }} />
            <Stack.Screen name="auth" />
            <Stack.Screen name="lock" options={{ animation: "fade" }} />
            <Stack.Screen name="bootstrap" options={{ animation: "fade" }} />
            <Stack.Screen name="(users)" options={{ animation: "fade" }} />
            <Stack.Screen name="(drivers)" options={{ animation: "fade" }} />
            <Stack.Screen
              name="settings"
              options={{
                headerShown: false,
                presentation: "modal",
                animation: modalTransition,
              }}
            />
            <Stack.Screen
              name="language-picker"
              options={{
                headerShown: false,
                presentation: "modal",
                animation: modalTransition,
              }}
            />
          </Stack>
        </View>
      </MapProviderProvider>
    </GestureHandlerRootView>
  );
}
