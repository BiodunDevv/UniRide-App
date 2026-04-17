import React, { useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  Platform,
  AppState,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";
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

  const title = needsUpdate ? "Update required" : "Scheduled maintenance";
  const statusBadge = needsUpdate ? "Action needed" : "System hold";
  const summary = needsUpdate
    ? "A newer UniRide build is now required for secure sign-in and service compatibility."
    : "UniRide is temporarily paused while backend services are being updated and verified.";
  const details = needsUpdate
    ? "Open your app store to install the latest version, then return to continue."
    : "We automatically re-check system availability every 30 seconds and when the app returns to the foreground.";

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-1 px-5 pb-8 pt-3">
        <Animated.View
          entering={FadeInUp.duration(420)}
          className="w-full"
          style={{ maxWidth: 620, alignSelf: "center" }}
        >
          <View className="mb-4 flex-row items-center">
            <View
              className={`mr-3 h-11 w-11 items-center justify-center rounded-2xl ${
                needsUpdate ? "bg-blue-50" : "bg-amber-50"
              }`}
            >
              <Ionicons
                name={
                  needsUpdate ? "cloud-download-outline" : "construct-outline"
                }
                size={18}
                color={needsUpdate ? "#2563EB" : "#D97706"}
              />
            </View>
            <View className="flex-1">
              <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Platform Status
              </Text>
              <Text className="mt-1 text-xl font-bold text-slate-900">
                {title}
              </Text>
            </View>
            <View
              className={`rounded-full px-3 py-1.5 ${
                needsUpdate ? "bg-blue-50" : "bg-amber-50"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  needsUpdate ? "text-blue-700" : "text-amber-700"
                }`}
              >
                {statusBadge}
              </Text>
            </View>
          </View>

          <View className="rounded-[28px] bg-[#042F40] px-5 py-5">
            <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4A017]">
              System Broadcast
            </Text>
            <Text className="mt-2 text-2xl font-bold text-white">
              {needsUpdate
                ? "Version compliance required"
                : "Service window active"}
            </Text>
            <Text className="mt-2 text-sm leading-6 text-slate-300">
              {summary}
            </Text>

            <View className="mt-5 flex-row gap-3">
              <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                <Text className="text-[11px] text-slate-300">
                  <T>Current</T>
                </Text>
                <Text className="mt-1 text-base font-bold text-white">
                  v{appVersion}
                </Text>
              </View>
              <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                <Text className="text-[11px] text-slate-300">
                  {needsUpdate ? <T>Required</T> : <T>Refresh</T>}
                </Text>
                <Text className="mt-1 text-base font-bold text-white">
                  {needsUpdate ? settings.app_version_minimum : "30 sec"}
                </Text>
              </View>
            </View>
          </View>

          <View className="mt-4 rounded-[26px] border border-slate-200 bg-white p-4">
            <View className="mb-3 flex-row items-center">
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-violet-50">
                <Ionicons name="build-outline" size={17} color="#7C3AED" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-slate-900">
                  Next action
                </Text>
                <Text className="text-xs leading-5 text-slate-500">
                  {details}
                </Text>
              </View>
            </View>

            {needsUpdate ? (
              <TouchableOpacity
                onPress={handleUpdate}
                className="items-center rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3.5"
                activeOpacity={0.88}
              >
                <View className="flex-row items-center">
                  <Ionicons name="download-outline" size={17} color="#FFFFFF" />
                  <Text className="ml-2 text-sm font-semibold text-white">
                    <T>Update now</T>
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleRetry}
                disabled={isLoading}
                className={`items-center rounded-2xl border px-4 py-3.5 ${
                  isLoading
                    ? "border-slate-200 bg-slate-100"
                    : "border-slate-900 bg-slate-900"
                }`}
                activeOpacity={0.88}
              >
                <View className="flex-row items-center">
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#334155" />
                  ) : (
                    <Ionicons
                      name="refresh-outline"
                      size={17}
                      color="#FFFFFF"
                    />
                  )}
                  <Text
                    className={`ml-2 text-sm font-semibold ${
                      isLoading ? "text-slate-700" : "text-white"
                    }`}
                  >
                    {isLoading ? <T>Checking status...</T> : <T>Try again</T>}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          <View className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-slate-500">App</Text>
              <Text className="text-xs font-semibold text-slate-700">
                UniRide v{appVersion}
              </Text>
            </View>
            <Text className="mt-1 text-xs text-slate-500">
              {needsUpdate ? (
                <T>After update, reopen UniRide to continue.</T>
              ) : (
                <T>
                  We will route you back automatically once services return.
                </T>
              )}
            </Text>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
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
