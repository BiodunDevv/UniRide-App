import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/store/useAuthStore";
import { useBootstrapStore } from "@/store/useBootstrapStore";
import { usePlatformSettingsStore } from "@/store/usePlatformSettingsStore";
import { useLocation } from "@/hooks/use-location";
import { useSocket } from "@/hooks/use-socket";
import {
  clearBootstrapTrace,
  getBootstrapTrace,
  getDashboardRoute,
  recordBootstrapTrace,
} from "@/lib/post-auth";

type BootstrapMode = "full" | "safe";

type StepStatus = "pending" | "active" | "done" | "warning";

type StepItem = {
  key: string;
  label: string;
  status: StepStatus;
  note?: string;
};

const BASE_STEPS: StepItem[] = [
  { key: "session", label: "Validating session", status: "pending" },
  { key: "settings", label: "Loading platform settings", status: "pending" },
  { key: "location", label: "Preparing location services", status: "pending" },
  { key: "socket", label: "Connecting live services", status: "pending" },
  { key: "route", label: "Opening dashboard", status: "pending" },
];

export default function BootstrapScreen() {
  const router = useRouter();
  const { token, user, fetchMe, logout } = useAuthStore();
  const fetchSettings = usePlatformSettingsStore((state) => state.fetchSettings);
  const { requestPermission, getCurrentLocation } = useLocation();
  const { connect } = useSocket();
  const {
    begin,
    advance,
    complete,
    fail,
    enableSafeMode,
    disableSafeMode,
    safeMode,
    lastError,
  } = useBootstrapStore();

  const [steps, setSteps] = useState(BASE_STEPS);
  const [mode, setMode] = useState<BootstrapMode>("full");
  const [trace, setTrace] = useState<string[]>([]);
  const didStart = useRef(false);
  const isMounted = useRef(true);
  const buildVersion =
    Constants.expoConfig?.version || Constants.nativeAppVersion || "1.0.0";

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const updateStep = useCallback(
    (key: string, status: StepStatus, note?: string) => {
      setSteps((current) =>
        current.map((step) =>
          step.key === key ? { ...step, status, note } : step,
        ),
      );
    },
    [],
  );

  const refreshTrace = useCallback(async () => {
    const entries = await getBootstrapTrace();
    if (isMounted.current) {
      setTrace(entries.slice(-8).reverse());
    }
  }, []);

  const resetSteps = useCallback(() => {
    setSteps(BASE_STEPS);
  }, []);

  const runBootstrap = useCallback(
    async (nextMode: BootstrapMode) => {
      setMode(nextMode);
      resetSteps();
      begin("session");
      if (nextMode === "safe") enableSafeMode();
      else disableSafeMode();

      await clearBootstrapTrace();
      await recordBootstrapTrace("bootstrap:start", `mode=${nextMode}`);

      try {
        updateStep("session", "active");
        if (!token) {
          await recordBootstrapTrace("bootstrap:no-token");
          router.replace("/auth/role-select");
          return;
        }

        await fetchMe();
        const freshUser = useAuthStore.getState().user;
        if (!freshUser) {
          throw new Error("Your session is no longer valid. Please sign in again.");
        }
        updateStep("session", "done", freshUser.email);
        advance("settings");
        await recordBootstrapTrace(
          "bootstrap:session-ok",
          `role=${freshUser.role}`,
        );

        updateStep("settings", "active");
        try {
          await fetchSettings();
          updateStep("settings", "done");
          await recordBootstrapTrace("bootstrap:settings-ok");
        } catch (error: any) {
          updateStep(
            "settings",
            "warning",
            error?.message || "Using cached defaults",
          );
          await recordBootstrapTrace(
            "bootstrap:settings-warning",
            error?.message || "cached defaults",
          );
        }

        advance("location");
        updateStep("location", "active");
        if (nextMode === "safe") {
          updateStep("location", "warning", "Skipped in recovery mode");
          await recordBootstrapTrace("bootstrap:location-skipped");
        } else {
          try {
            const granted = await requestPermission();
            if (granted) {
              await getCurrentLocation();
              updateStep("location", "done");
              await recordBootstrapTrace("bootstrap:location-ok");
            } else {
              updateStep("location", "warning", "Permission not granted");
              await recordBootstrapTrace("bootstrap:location-denied");
            }
          } catch (error: any) {
            updateStep(
              "location",
              "warning",
              error?.message || "Location startup skipped",
            );
            enableSafeMode();
            await recordBootstrapTrace(
              "bootstrap:location-warning",
              error?.message || "startup skipped",
            );
          }
        }

        advance("socket");
        updateStep("socket", "active");
        if (nextMode === "safe") {
          updateStep("socket", "warning", "Skipped in recovery mode");
          await recordBootstrapTrace("bootstrap:socket-skipped");
        } else {
          try {
            await connect();
            updateStep("socket", "done");
            await recordBootstrapTrace("bootstrap:socket-ok");
          } catch (error: any) {
            updateStep(
              "socket",
              "warning",
              error?.message || "Live updates will reconnect later",
            );
            await recordBootstrapTrace(
              "bootstrap:socket-warning",
              error?.message || "reconnect later",
            );
          }
        }

        advance("route");
        updateStep("route", "active");
        const nextRoute = getDashboardRoute(useAuthStore.getState().user);
        complete(nextRoute);
        updateStep(
          "route",
          "done",
          nextMode === "safe" ? "Recovery mode enabled" : "Ready",
        );
        await recordBootstrapTrace("bootstrap:route", nextRoute);
        router.replace(nextRoute as any);
      } catch (error: any) {
        const message =
          error?.message || "We could not finish preparing your dashboard.";
        fail(message);
        updateStep("route", "warning", message);
        await recordBootstrapTrace("bootstrap:failed", message);
        await refreshTrace();
      }
    },
    [
      advance,
      begin,
      complete,
      connect,
      disableSafeMode,
      enableSafeMode,
      fail,
      fetchMe,
      fetchSettings,
      getCurrentLocation,
      refreshTrace,
      requestPermission,
      resetSteps,
      router,
      token,
      updateStep,
    ],
  );

  useEffect(() => {
    if (didStart.current) return;
    didStart.current = true;
    runBootstrap("full");
  }, [runBootstrap]);

  useEffect(() => {
    refreshTrace();
  }, [lastError, refreshTrace]);

  const title = useMemo(() => {
    if (lastError) return "Dashboard recovery";
    return mode === "safe"
      ? "Starting in recovery mode"
      : "Preparing your dashboard";
  }, [lastError, mode]);

  const subtitle = useMemo(() => {
    if (lastError) {
      return "UniRide stopped before finishing startup. We are now bringing services back one by one so you can safely get into the app.";
    }
    return "We are validating your session and warming up the services that run after sign-in so Android does not get hit with everything at once.";
  }, [lastError]);

  const handleRetry = () => {
    runBootstrap("full");
  };

  const handleContinueWithoutMap = () => {
    runBootstrap("safe");
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } finally {
      router.replace("/auth/role-select");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#031E29]">
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow px-5 py-5"
        showsVerticalScrollIndicator={false}
      >
        <View
          className="w-full flex-1"
          style={{
            maxWidth: 620,
            alignSelf: "center",
          }}
        >
          <View className="rounded-[34px] bg-[#062634] px-6 py-6">
            <View className="flex-row items-start justify-between">
              <View className="mr-4 flex-1">
                <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4A017]">
                  Post-Login Bootstrap
                </Text>
                <Text className="mt-3 text-3xl font-bold text-white">
                  {title}
                </Text>
                <Text className="mt-3 text-sm leading-6 text-slate-300">
                  {subtitle}
                </Text>
              </View>
              <View className="h-14 w-14 items-center justify-center rounded-[20px] bg-white/10">
                <Ionicons
                  name={safeMode ? "shield-checkmark-outline" : "flash-outline"}
                  size={24}
                  color="#D4A017"
                />
              </View>
            </View>

            <View className="mt-5 flex-row gap-3">
              <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                <Text className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
                  Build
                </Text>
                <Text className="mt-1 text-base font-bold text-white">
                  v{buildVersion}
                </Text>
              </View>
              <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                <Text className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
                  Mode
                </Text>
                <Text className="mt-1 text-base font-bold text-white">
                  {safeMode ? "Recovery" : "Full startup"}
                </Text>
              </View>
            </View>
          </View>

          <View className="mt-5 rounded-[30px] bg-white px-4 py-4">
            <Text className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Startup sequence
            </Text>
            <View className="mt-2">
              {steps.map((step) => (
                <View
                  key={step.key}
                  className="flex-row items-start border-b border-slate-100 py-3 last:border-b-0"
                >
                  <View className="mr-3 mt-0.5">
                    {step.status === "done" ? (
                      <View className="h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                        <Ionicons name="checkmark" size={18} color="#047857" />
                      </View>
                    ) : step.status === "warning" ? (
                      <View className="h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                        <Ionicons
                          name="warning-outline"
                          size={18}
                          color="#B45309"
                        />
                      </View>
                    ) : step.status === "active" ? (
                      <View className="h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                        <ActivityIndicator size="small" color="#042F40" />
                      </View>
                    ) : (
                      <View className="h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                        <Ionicons
                          name="ellipse-outline"
                          size={16}
                          color="#64748B"
                        />
                      </View>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-slate-900">
                      {step.label}
                    </Text>
                    {step.note ? (
                      <Text className="mt-1 text-xs leading-5 text-slate-500">
                        {step.note}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="mt-5 rounded-[30px] border border-white/10 bg-white/5 px-5 py-5">
            <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
              Recovery actions
            </Text>
            <Text className="mt-2 text-sm leading-6 text-slate-300">
              {lastError
                ? "A startup stage failed. You can retry the full live dashboard, continue in no-map recovery mode, or sign out safely."
                : "If a release build still struggles with maps or live services, you can continue in recovery mode and retry the full dashboard later."}
            </Text>

            {lastError ? (
              <View className="mt-4 rounded-[24px] border border-amber-400/25 bg-amber-400/10 px-4 py-4">
                <Text className="text-sm font-semibold text-amber-200">
                  {lastError}
                </Text>
              </View>
            ) : null}

            <View className="mt-5 gap-3">
              <Pressable
                onPress={handleRetry}
                className="items-center rounded-2xl bg-[#D4A017] px-4 py-4"
              >
                <Text className="text-sm font-bold text-[#031E29]">
                  Retry full startup
                </Text>
              </Pressable>

              <Pressable
                onPress={handleContinueWithoutMap}
                className="items-center rounded-2xl border border-white/15 bg-white/5 px-4 py-4"
              >
                <Text className="text-sm font-semibold text-white">
                  Continue without live map
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSignOut}
                className="items-center rounded-2xl border border-white/10 px-4 py-4"
              >
                <Text className="text-sm font-semibold text-slate-200">
                  Sign out instead
                </Text>
              </Pressable>
            </View>
          </View>

          {trace.length > 0 ? (
            <View className="mt-5 rounded-[24px] border border-white/10 bg-black/10 px-4 py-4">
              <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                Recent trace
              </Text>
              {trace.map((entry) => (
                <Text
                  key={entry}
                  className="mt-2 text-[11px] leading-5 text-slate-400"
                >
                  {entry}
                </Text>
              ))}
            </View>
          ) : null}

          <Text className="mt-5 text-center text-xs text-slate-400">
            {user?.email || "Session pending"} {safeMode ? "· Recovery mode" : ""}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
