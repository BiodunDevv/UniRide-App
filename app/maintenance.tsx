import React, { useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  Platform,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInUp,
  FadeInDown,
  FadeIn,
} from "react-native-reanimated";
import { usePlatformSettingsStore } from "@/store/usePlatformSettingsStore";
import { T } from "@/hooks/use-translation";
import Constants from "expo-constants";

export default function MaintenanceScreen() {
  const router = useRouter();
  const { settings, fetchSettings, isLoading } = usePlatformSettingsStore();

  // Poll for settings changes (every 30s) and when app comes to foreground
  useEffect(() => {
    const iv = setInterval(fetchSettings, 30000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") fetchSettings();
    });
    return () => {
      clearInterval(iv);
      sub.remove();
    };
  }, []);

  // If maintenance is lifted, navigate back
  useEffect(() => {
    if (!settings.maintenance_mode) {
      router.replace("/");
    }
  }, [settings.maintenance_mode]);

  // Check if app version is below minimum
  const appVersion = Constants.expoConfig?.version || "1.0.0";
  const needsUpdate =
    compareVersions(appVersion, settings.app_version_minimum) < 0;

  const handleRetry = useCallback(async () => {
    await fetchSettings();
  }, []);

  const handleUpdate = useCallback(() => {
    const storeUrl = Platform.select({
      ios: "https://apps.apple.com",
      android: "https://play.google.com/store",
      default: "https://play.google.com/store",
    });
    Linking.openURL(storeUrl);
  }, []);

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView className="flex-1 items-center justify-center px-8">
        {/* Background circles */}
        <View className="absolute top-20 -left-10 w-40 h-40 rounded-full bg-amber-50/50" />
        <View className="absolute bottom-32 -right-14 w-52 h-52 rounded-full bg-primary/5" />

        {needsUpdate ? (
          /* ── App Update Required ──────────────────────────────────── */
          <Animated.View
            entering={FadeInUp.duration(500)}
            className="items-center"
          >
            <View className="w-24 h-24 rounded-full bg-blue-50 items-center justify-center mb-6">
              <Ionicons
                name="cloud-download-outline"
                size={48}
                color="#2563EB"
              />
            </View>
            <Text className="text-2xl font-bold text-gray-900 text-center mb-3">
              <T>Update Required</T>
            </Text>
            <Text className="text-sm text-gray-500 text-center leading-6 mb-2">
              <T>
                A new version of UniRide is available. Please update to continue
                using the app.
              </T>
            </Text>
            <Text className="text-xs text-gray-400 text-center mb-8">
              <T>Current:</T> {appVersion} → <T>Required:</T>{" "}
              {settings.app_version_minimum}
            </Text>

            <Animated.View
              entering={FadeInDown.delay(300).duration(400)}
              className="w-full"
            >
              <TouchableOpacity
                onPress={handleUpdate}
                className="bg-primary rounded-2xl py-4 items-center mb-3"
                activeOpacity={0.8}
              >
                <View className="flex-row items-center">
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <Text className="text-white font-bold text-base ml-2">
                    <T>Update Now</T>
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        ) : (
          /* ── Maintenance Mode ─────────────────────────────────────── */
          <Animated.View
            entering={FadeInUp.duration(500)}
            className="items-center"
          >
            <View className="w-24 h-24 rounded-full bg-amber-50 items-center justify-center mb-6">
              <Ionicons name="construct-outline" size={48} color="#D97706" />
            </View>
            <Text className="text-2xl font-bold text-gray-900 text-center mb-3">
              <T>Under Maintenance</T>
            </Text>
            <Text className="text-sm text-gray-500 text-center leading-6 mb-2">
              <T>
                We're performing scheduled maintenance to improve your
                experience. The app will be back shortly.
              </T>
            </Text>
            <Text className="text-xs text-gray-400 text-center mb-8">
              <T>Thank you for your patience</T>
            </Text>

            <Animated.View
              entering={FadeInDown.delay(300).duration(400)}
              className="w-full"
            >
              <TouchableOpacity
                onPress={handleRetry}
                disabled={isLoading}
                className={`rounded-2xl py-4 items-center mb-3 ${isLoading ? "bg-gray-200" : "bg-primary"}`}
                activeOpacity={0.8}
              >
                <View className="flex-row items-center justify-center">
                  <Text
                    className={`font-semibold text-base ${
                      isLoading ? "text-gray-400" : "text-white"
                    }`}
                  >
                    {isLoading ? <T>Checking...</T> : <T>Try Again</T>}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>

            {/* Animated dots */}
            <Animated.View
              entering={FadeIn.delay(600).duration(400)}
              className="flex-row items-center mt-6"
            >
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  className={`w-2 h-2 rounded-full mx-1 ${i === 1 ? "bg-amber-400" : "bg-amber-200"}`}
                />
              ))}
            </Animated.View>
          </Animated.View>
        )}

        {/* Version footer */}
        <Animated.View
          entering={FadeIn.delay(800).duration(300)}
          className="absolute bottom-8"
        >
          <Text className="text-xs text-gray-300">UniRide v{appVersion}</Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// ── Semver compare ────────────────────────────────────────────────────────
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
