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
  const fetchSettings = usePlatformSettingsStore(
    (state) => state.fetchSettings,
  );
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
          throw new Error(
            "Your session is no longer valid. Please sign in again.",
          );
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

  const completedSteps = useMemo(
    () => steps.filter((step) => step.status === "done").length,
    [steps],
  );

  const warningSteps = useMemo(
    () => steps.filter((step) => step.status === "warning").length,
    [steps],
  );

  const activeStepLabel = useMemo(
    () => steps.find((step) => step.status === "active")?.label,
    [steps],
  );

  const progressPercent = useMemo(() => {
    if (!steps.length) return 0;
    return Math.round((completedSteps / steps.length) * 100);
  }, [completedSteps, steps.length]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-10 pt-3"
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full" style={{ maxWidth: 620, alignSelf: "center" }}>
          <View className="mb-4 flex-row items-center">
            <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
              <Ionicons
                name={safeMode ? "shield-checkmark-outline" : "flash-outline"}
                size={18}
                color="#042F40"
              />
            </View>
            <View className="flex-1">
              <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                UniRide Experience
              </Text>
              <Text className="mt-1 text-xl font-bold text-[#042F40]">
                {title}
              </Text>
            </View>
            <View
              className={`rounded-full px-3 py-1.5 ${
                safeMode ? "bg-amber-50" : "bg-emerald-50"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  safeMode ? "text-amber-700" : "text-emerald-700"
                }`}
              >
                {safeMode ? "Recovery" : "Live"}
              </Text>
            </View>
          </View>

          <View className="rounded-[28px] bg-[#042F40] px-5 py-5">
            <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4A017]">
              Startup Status
            </Text>
            <Text className="mt-2 text-2xl font-bold text-white">
              {safeMode
                ? "Recovery startup in progress"
                : "Preparing UniRide services"}
            </Text>
            <Text className="mt-2 text-sm leading-6 text-slate-300">
              {subtitle}
            </Text>

            <View className="mt-5 flex-row gap-3">
              <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                <Text className="text-[11px] text-slate-300">Build</Text>
                <Text className="mt-1 text-base font-bold text-white">
                  v{buildVersion}
                </Text>
              </View>
              <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                <Text className="text-[11px] text-slate-300">Mode</Text>
                <Text className="mt-1 text-base font-bold text-white">
                  {mode === "safe" ? "Recovery" : "Full startup"}
                </Text>
              </View>
            </View>

            <View className="mt-3 rounded-2xl bg-white/10 px-4 py-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-[11px] text-slate-300">Progress</Text>
                <Text className="text-[11px] font-semibold text-white">
                  {completedSteps}/{steps.length} complete
                </Text>
              </View>
              <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
                <View
                  className="h-full rounded-full bg-[#D4A017]"
                  style={{ width: `${progressPercent}%` }}
                />
              </View>
              <Text className="mt-2 text-[11px] text-slate-300">
                {activeStepLabel
                  ? `Current: ${activeStepLabel}`
                  : "All startup steps completed"}
              </Text>
            </View>
          </View>

          <View className="mt-4 rounded-[26px] border border-slate-200 bg-white p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                  <Ionicons name="list-outline" size={17} color="#042F40" />
                </View>
                <View>
                  <Text className="text-sm font-semibold text-[#042F40]">
                    Startup Steps
                  </Text>
                  <Text className="text-xs text-slate-500">
                    Real-time execution
                  </Text>
                </View>
              </View>
              <View className="rounded-full bg-slate-100 px-3 py-1.5">
                <Text className="text-xs font-semibold text-slate-700">
                  {progressPercent}%
                </Text>
              </View>
            </View>

            <View className="gap-2">
              {steps.map((step, index) => {
                const isDone = step.status === "done";
                const isWarning = step.status === "warning";
                const isActive = step.status === "active";

                return (
                  <View
                    key={step.key}
                    className={`rounded-2xl border px-3.5 py-3 ${
                      isDone
                        ? "border-emerald-100 bg-emerald-50"
                        : isWarning
                          ? "border-amber-100 bg-amber-50"
                          : isActive
                            ? "border-slate-300 bg-slate-100"
                            : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 flex-row items-start">
                        <View
                          className={`mr-3 h-9 w-9 items-center justify-center rounded-xl ${
                            isDone
                              ? "bg-emerald-100"
                              : isWarning
                                ? "bg-amber-100"
                                : "bg-slate-200"
                          }`}
                        >
                          {isActive ? (
                            <ActivityIndicator size="small" color="#334155" />
                          ) : isDone ? (
                            <Ionicons
                              name="checkmark"
                              size={17}
                              color="#047857"
                            />
                          ) : isWarning ? (
                            <Ionicons
                              name="warning-outline"
                              size={17}
                              color="#B45309"
                            />
                          ) : (
                            <Ionicons
                              name="time-outline"
                              size={16}
                              color="#64748B"
                            />
                          )}
                        </View>

                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-[#042F40]">
                            {index + 1}. {step.label}
                          </Text>
                          {step.note ? (
                            <Text className="mt-1 text-xs leading-5 text-slate-600">
                              {step.note}
                            </Text>
                          ) : (
                            <Text className="mt-1 text-xs leading-5 text-slate-500">
                              {isDone
                                ? "Completed successfully"
                                : isActive
                                  ? "Running now"
                                  : isWarning
                                    ? "Needs attention"
                                    : "Queued"}
                            </Text>
                          )}
                        </View>
                      </View>

                      <View
                        className={`ml-2 rounded-full px-2.5 py-1 ${
                          isDone
                            ? "bg-emerald-100"
                            : isWarning
                              ? "bg-amber-100"
                              : isActive
                                ? "bg-slate-200"
                                : "bg-slate-200"
                        }`}
                      >
                        <Text
                          className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
                            isDone
                              ? "text-emerald-700"
                              : isWarning
                                ? "text-amber-700"
                                : isActive
                                  ? "text-slate-700"
                                  : "text-slate-500"
                          }`}
                        >
                          {isDone
                            ? "Done"
                            : isWarning
                              ? "Warning"
                              : isActive
                                ? "Running"
                                : "Pending"}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View className="mt-4 rounded-[26px] border border-slate-200 bg-white p-4">
            <View className="mb-3 flex-row items-center">
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                <Ionicons name="build-outline" size={17} color="#042F40" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-[#042F40]">
                  Support Actions
                </Text>
                <Text className="text-xs leading-5 text-slate-500">
                  Retry full startup, continue in recovery mode, or sign out
                  safely.
                </Text>
              </View>
            </View>

            <Text className="text-sm leading-6 text-slate-600">
              {lastError
                ? "A startup stage failed. You can retry the full live dashboard, continue in no-map recovery mode, or sign out safely."
                : "If a release build still struggles with maps or live services, you can continue in recovery mode and retry the full dashboard later."}
            </Text>

            {lastError ? (
              <View className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                <View className="flex-row items-start">
                  <Ionicons
                    name="warning-outline"
                    size={16}
                    color="#B45309"
                    style={{ marginTop: 1 }}
                  />
                  <Text className="ml-2 flex-1 text-xs font-semibold leading-5 text-amber-700">
                    {lastError}
                  </Text>
                </View>
              </View>
            ) : null}

            <View className="mt-4 gap-2.5">
              <Pressable
                onPress={handleRetry}
                className="items-center rounded-2xl border border-[#042F40] bg-[#042F40] px-4 py-3.5"
              >
                <Text className="text-sm font-semibold text-white">
                  Retry full startup
                </Text>
              </Pressable>

              <Pressable
                onPress={handleContinueWithoutMap}
                className="items-center rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3.5"
              >
                <Text className="text-sm font-semibold text-slate-700">
                  Continue without live map
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSignOut}
                className="items-center rounded-2xl border border-red-100 bg-red-50 px-4 py-3.5"
              >
                <Text className="text-sm font-semibold text-red-600">
                  Sign out instead
                </Text>
              </Pressable>
            </View>
          </View>

          {trace.length > 0 ? (
            <View className="mt-4 rounded-[24px] border border-slate-200 bg-white px-4 py-4">
              <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Recent Trace
              </Text>
              {trace.map((entry) => (
                <Text
                  key={entry}
                  className="mt-2 text-[11px] leading-5 text-slate-500"
                >
                  {entry}
                </Text>
              ))}
            </View>
          ) : null}

          <View className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-slate-500">
                Session
              </Text>
              <Text className="text-xs font-semibold text-slate-700">
                {safeMode ? "Recovery mode" : "Live mode"}
              </Text>
            </View>
            <Text className="mt-1 text-sm font-semibold text-[#042F40]">
              {user?.email || "Session pending"}
            </Text>
            {warningSteps > 0 ? (
              <Text className="mt-1 text-xs text-amber-600">
                {warningSteps} startup step{warningSteps === 1 ? "" : "s"}{" "}
                {warningSteps === 1 ? "needs" : "need"} attention.
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
