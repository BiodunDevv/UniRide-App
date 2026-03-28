import React, { useEffect, useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  InteractionManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import {
  MapView,
  Camera,
  LocationPuck,
} from "@/components/map/ExpoMap";
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOutUp,
  SlideInUp,
} from "react-native-reanimated";

import { useAuthStore } from "@/store/useAuthStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useRideStore } from "@/store/useRideStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useLocation } from "@/hooks/use-location";
import { useSocket } from "@/hooks/use-socket";
import { eventBus } from "@/lib/eventBus";
import { T } from "@/hooks/use-translation";
import { useReviewPrompt } from "@/hooks/use-review-prompt";
import LanguageOnboarding from "@/components/LanguageOnboarding";
import { usePlatformSettingsStore } from "@/store/usePlatformSettingsStore";
import { useBootstrapStore } from "@/store/useBootstrapStore";
import { recordBootstrapTrace } from "@/lib/post-auth";

export default function DriverHomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  useReviewPrompt(!!user);
  const {
    userLocation,
    lastDriverPresenceLocation,
    isDriverOnline: isOnline,
    goOnline,
    goOffline,
    updateLiveLocation,
    restoreOnlineState,
  } = useLocationStore();
  const {
    driverRides,
    fetchDriverRides,
    driverBookings,
    fetchDriverBookings,
    availableRequests,
    fetchAvailableRequests,
    isLoadingDriverRides,
  } = useRideStore();
  const { unreadCount, fetchNotifications } = useNotificationStore();
  const mapsEnabled = usePlatformSettingsStore(
    (state) => state.settings.expo_maps_enabled,
  );
  const safeMode = useBootstrapStore((state) => state.safeMode);
  const { requestPermission, startWatching, getCurrentLocation } =
    useLocation();
  const { connect, joinRoom, joinDriverFeed, joinLiveMap } = useSocket();

  const cameraRef = useRef<{ setCamera: (opts: any) => void }>(null);
  const hasCentered = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [mapType, setMapType] = useState<"hybrid" | "standard">("hybrid");
  const [allowMapCanvas, setAllowMapCanvas] = useState(false);
  const [sheetHidden, setSheetHidden] = useState(false);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [showTopOverlayCards, setShowTopOverlayCards] = useState(true);
  const locationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  const firstName = user?.name?.split(" ")[0] || "Driver";
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "D";

  // ── Init ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) {
        setAllowMapCanvas(Boolean(mapsEnabled) && !safeMode);
      }
    });

    recordBootstrapTrace(
      "driver-home:mount",
      safeMode ? "safe-mode" : "full-mode",
    ).catch(() => {});

    (async () => {
      try {
        if (!safeMode) {
          const ok = await requestPermission();
          if (ok && !cancelled) {
            await getCurrentLocation();
            if (!cancelled) {
              setTimeout(() => {
                if (!cancelled) startWatching();
              }, 250);
            }
          }
        }
      } catch (e) {
        console.warn("Location init error:", e);
      }
      try {
        if (!safeMode) {
          await connect();
          if (user) {
            joinRoom(user.id, user.role);
            joinDriverFeed();
          }
          joinLiveMap();
        }
      } catch (e) {
        console.warn("Socket init error:", e);
      }
      try {
        fetchDriverRides();
        fetchDriverBookings();
        fetchAvailableRequests();
        fetchNotifications();
      } catch (e) {
        console.warn("Data fetch init error:", e);
      }
      // Restore persistent online state if driver was online before
      try {
        restoreOnlineState();
      } catch {}
    })();
    return () => {
      cancelled = true;
      interactionHandle.cancel();
      if (locationInterval.current) clearInterval(locationInterval.current);
    };
  }, [mapsEnabled, safeMode]);

  useFocusEffect(
    useCallback(() => {
      fetchDriverRides();
      fetchDriverBookings();
      fetchAvailableRequests();
      fetchNotifications();
    }, []),
  );

  // ── Background auto-refresh every 8s ──────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      fetchDriverRides();
      fetchDriverBookings();
      fetchAvailableRequests();
    }, 8000);
    return () => clearInterval(iv);
  }, []);

  // ── Socket events: real-time updates ──────────────────────────────
  useEffect(() => {
    const refresh = () => {
      fetchDriverRides();
      fetchDriverBookings();
      fetchAvailableRequests();
      fetchNotifications();
    };
    const u1 = eventBus.on("booking:updated", refresh);
    const u2 = eventBus.on("booking:cancelled", refresh);
    const u3 = eventBus.on("booking:checkin", refresh);
    const u4 = eventBus.on("ride:new_request", refresh);
    const u5 = eventBus.on("ride:accepted", refresh);
    const u6 = eventBus.on("ride:ended", refresh);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
    };
  }, []);

  // ── Live location broadcast when online ───────────────────────────
  useEffect(() => {
    if (!safeMode && isOnline && userLocation) {
      if (locationInterval.current) clearInterval(locationInterval.current);
      locationInterval.current = setInterval(() => {
        const loc = useLocationStore.getState().userLocation;
        if (loc) updateLiveLocation(loc.latitude, loc.longitude, 0);
      }, 5000);
    } else {
      if (locationInterval.current) {
        clearInterval(locationInterval.current);
        locationInterval.current = null;
      }
    }
    return () => {
      if (locationInterval.current) clearInterval(locationInterval.current);
    };
  }, [isOnline, safeMode, userLocation]);

  // ── Toggle online ─────────────────────────────────────────────────
  const doToggle = async () => {
    setToggling(true);
    try {
      if (isOnline) {
        await goOffline();
      } else {
        let loc = userLocation;
        if (!loc) {
          loc = (await getCurrentLocation()) as any;
        }
        if (loc) {
          await goOnline(loc.latitude, loc.longitude, 0);
        } else {
          Alert.alert("Error", "Could not get your location");
          return;
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed");
    }
    setToggling(false);
  };

  const handleToggle = () => {
    if (isOnline) {
      // Block going offline if driver has in-progress or accepted rides
      const blockers = driverRides.filter(
        (r) => r.status === "in_progress" || r.status === "accepted",
      );
      if (blockers.length > 0) {
        Alert.alert(
          "Cannot Go Offline",
          `You have ${blockers.length} active ride${blockers.length > 1 ? "s" : ""} that must be completed or cancelled before you can go offline.`,
          [{ text: "OK" }],
        );
        return;
      }

      Alert.alert(
        "Go Offline?",
        "You will no longer be visible to passengers and won't receive new ride requests. Are you sure you want to go offline?",
        [
          { text: "Stay Online", style: "cancel" },
          {
            text: "Go Offline",
            style: "destructive",
            onPress: doToggle,
          },
        ],
      );
    } else {
      Alert.alert(
        "Go Online?",
        "You'll be visible to passengers and can receive ride requests. Make sure you're ready to accept rides.",
        [
          { text: "Not Now", style: "cancel" },
          {
            text: "Go Online",
            onPress: doToggle,
          },
        ],
      );
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchDriverRides(),
      fetchDriverBookings(),
      fetchAvailableRequests(),
    ]);
    setRefreshing(false);
  }, []);

  const centerOnSelf = useCallback(() => {
    if (userLocation && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [userLocation.longitude, userLocation.latitude],
        zoomLevel: 15,
        animationDuration: 800,
      });
    }
  }, [userLocation]);

  // ── Center camera on first location fix ────────────────────────────
  useEffect(() => {
    if (userLocation && cameraRef.current && !hasCentered.current) {
      hasCentered.current = true;
      cameraRef.current.setCamera({
        centerCoordinate: [userLocation.longitude, userLocation.latitude],
        zoomLevel: 14,
        pitch: 45,
        animationDuration: 1200,
      });
    }
  }, [userLocation]);

  // ── Derived ───────────────────────────────────────────────────────
  const activeRides = driverRides.filter(
    (r) =>
      r.status === "in_progress" ||
      r.status === "accepted" ||
      r.status === "available" ||
      r.status === "scheduled",
  );
  const pendingBookings = driverBookings.filter((b) => b.status === "pending");
  const completedCount = driverRides.filter(
    (r) => r.status === "completed",
  ).length;
  const liveRideCount = driverRides.filter(
    (r) => r.status === "accepted" || r.status === "in_progress",
  ).length;
  const idleRideCount = driverRides.filter(
    (r) => r.status === "available" || r.status === "scheduled",
  ).length;
  const currentPriorityRide =
    driverRides.find((r) => r.status === "in_progress") ||
    driverRides.find((r) => r.status === "accepted") ||
    null;
  const showMapCanvas = mapsEnabled && allowMapCanvas && !safeMode;
  const sheetSnapPoints = React.useMemo(
    () => (showMapCanvas ? ["20%", "50%", "84%"] : ["40%", "68%", "92%"]),
    [showMapCanvas],
  );
  const initialSheetIndex = showMapCanvas ? 0 : 1;

  useEffect(() => {
    setSheetIndex(initialSheetIndex);
    setShowTopOverlayCards(initialSheetIndex <= 1);
  }, [initialSheetIndex]);

  const handleSheetChange = useCallback((index: number) => {
    setSheetHidden(index === -1);
    setSheetIndex(index);
  }, []);

  const handleSheetAnimate = useCallback(
    (_fromIndex: number, toIndex: number) => {
      setShowTopOverlayCards(toIndex <= 1);
    },
    [],
  );

  const openSheet = useCallback(() => {
    setSheetHidden(false);
    bottomSheetRef.current?.snapToIndex(Math.min(1, sheetSnapPoints.length - 1));
  }, [sheetSnapPoints.length]);

  const expandSheet = useCallback(() => {
    setSheetHidden(false);
    bottomSheetRef.current?.snapToIndex(sheetSnapPoints.length - 1);
  }, [sheetSnapPoints.length]);

  const openCreateRide = useCallback(() => {
    if (!isOnline) {
      Alert.alert(
        "Go Online First",
        "You need to be online before you can create a ride. Go online now?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Go Online", onPress: doToggle },
        ],
      );
      return;
    }
    router.push("/(drivers)/create-ride" as any);
  }, [doToggle, isOnline, router]);

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <View className={`flex-1 ${showMapCanvas ? "bg-white" : "bg-slate-50"}`}>
      {/* ── Full-Screen Map ────────────────────────────────────────── */}
      {showMapCanvas ? (
        <MapView
          style={{ flex: 1 }}
          mapType={mapType}
          showsCompass
          showsBuildings
        >
          <Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: userLocation
                ? [userLocation.longitude, userLocation.latitude]
                : lastDriverPresenceLocation
                  ? [
                      lastDriverPresenceLocation.longitude,
                      lastDriverPresenceLocation.latitude,
                    ]
                : [4.52, 7.52],
              zoomLevel: 14,
            }}
            animationDuration={1500}
          />
          <LocationPuck />
        </MapView>
      ) : (
        <View className="flex-1 bg-slate-200">
          <View className="absolute inset-0 bg-slate-300" />
          <View className="absolute inset-0 items-center justify-center px-6">
            <View className="w-full max-w-[360px] rounded-[30px] border border-white/60 bg-white/92 px-6 py-6">
              <View className="items-center">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                  <Ionicons name="map-outline" size={26} color="#042F40" />
                </View>
                <Text className="mt-4 text-center text-xl font-bold text-slate-900">
                  <T>Map is not available</T>
                </Text>
                <Text className="mt-2 text-center text-sm leading-6 text-slate-600">
                  <T>
                    You can still manage rides, bookings, and live operations
                    from the panel below while interactive maps are unavailable.
                  </T>
                </Text>
              </View>
              {safeMode ? (
                <TouchableOpacity
                  onPress={() => router.push("/bootstrap")}
                  className="mt-5 rounded-2xl bg-primary px-4 py-3 items-center"
                >
                  <Text className="text-sm font-semibold text-white">
                    <T>Try Map Again</T>
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      )}

      {/* ── Header ─────────────────────────────────────────────────── */}
      <SafeAreaView
        edges={["top"]}
        className="absolute top-0 left-0 right-0 z-10"
        pointerEvents="box-none"
      >
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          className="mx-5 mt-2"
        >
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.push("/(drivers)/profile")}
              className="flex-row items-center bg-white/95 rounded-2xl px-4 py-3"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
              }}
            >
              {user?.profile_picture ? (
                <Image
                  source={{ uri: user.profile_picture }}
                  className="w-9 h-9 rounded-full"
                />
              ) : (
                <View className="w-9 h-9 rounded-full bg-primary items-center justify-center">
                  <Text className="text-white font-bold text-xs">{initials}</Text>
                </View>
              )}
              <View className="ml-2.5">
                <Text className="text-[10px] text-gray-400">
                  <T>Driver</T>
                </Text>
                <Text className="text-sm font-bold text-gray-900">
                  {firstName}
                </Text>
              </View>
            </TouchableOpacity>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() =>
                  setMapType((current) =>
                    current === "hybrid" ? "standard" : "hybrid",
                  )
                }
                className="bg-white/95 w-10 h-10 rounded-full items-center justify-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 6,
                }}
              >
                <Ionicons
                  name={mapType === "hybrid" ? "map-outline" : "layers-outline"}
                  size={20}
                  color="#042F40"
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/(drivers)/notifications")}
                className="bg-white/95 w-10 h-10 rounded-full items-center justify-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 6,
                }}
              >
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color="#042F40"
                />
                {unreadCount > 0 && (
                  <View className="absolute -top-1 -right-1 bg-accent w-4 h-4 rounded-full items-center justify-center">
                    <Text className="text-[9px] text-white font-bold">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={centerOnSelf}
                className="bg-white/95 w-10 h-10 rounded-full items-center justify-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 6,
                }}
              >
                <Ionicons name="locate" size={20} color="#042F40" />
              </TouchableOpacity>
            </View>
          </View>

          {currentPriorityRide && showTopOverlayCards ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              exiting={FadeOutUp.duration(220)}
            >
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname:
                      currentPriorityRide.status === "in_progress"
                        ? "/(drivers)/active-ride"
                        : "/(drivers)/ride-details",
                    params: { rideId: currentPriorityRide._id },
                  } as any)
                }
                activeOpacity={0.9}
                className="mt-3 rounded-[24px] bg-primary px-4 py-3 flex-row items-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.12,
                  shadowRadius: 8,
                }}
              >
                <View className="w-10 h-10 rounded-full bg-white/15 items-center justify-center mr-3">
                  <Ionicons
                    name={
                      currentPriorityRide.status === "in_progress"
                        ? "navigate"
                        : "car-outline"
                    }
                    size={18}
                    color="#fff"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] uppercase tracking-[0.16em] text-white/70">
                    <T>Current ride</T>
                  </Text>
                  <Text className="mt-1 text-sm font-bold text-white">
                    {currentPriorityRide.status === "in_progress" ? (
                      <T>Open live ride</T>
                    ) : (
                      <T>Open accepted ride</T>
                    )}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
          ) : null}

          {(availableRequests.length > 0 || pendingBookings.length > 0) &&
          showTopOverlayCards ? (
            <Animated.View
              entering={FadeInDown.duration(240)}
              exiting={FadeOutUp.duration(220)}
            >
              <View
                className="mt-3 rounded-[24px] bg-white/95 px-3 py-3"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      <T>Live demand</T>
                    </Text>
                    <Text className="mt-1 text-sm font-bold text-slate-900">
                      {availableRequests.length > 0 ? (
                        <T>New ride requests are waiting</T>
                      ) : (
                        <T>Passenger bookings need attention</T>
                      )}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push("/(drivers)/ride-requests" as any)}
                    className="rounded-full bg-[#042F40] px-4 py-2.5"
                    activeOpacity={0.9}
                  >
                    <Text className="text-xs font-semibold text-white">
                      {availableRequests.length > 0 ? (
                        <T>Open requests</T>
                      ) : (
                        <T>Open panel</T>
                      )}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View className="mt-3 flex-row gap-2">
                  {availableRequests.length > 0 ? (
                    <TouchableOpacity
                      onPress={() => router.push("/(drivers)/ride-requests" as any)}
                      className="flex-1 rounded-2xl border border-violet-100 bg-violet-50 px-3 py-3"
                      activeOpacity={0.85}
                    >
                      <Text className="text-[11px] text-violet-700">
                        <T>Ride requests</T>
                      </Text>
                      <Text className="mt-1 text-lg font-bold text-violet-900">
                        {availableRequests.length}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {pendingBookings.length > 0 ? (
                    <TouchableOpacity
                      onPress={expandSheet}
                      className="flex-1 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-3"
                      activeOpacity={0.85}
                    >
                      <Text className="text-[11px] text-amber-700">
                        <T>Pending bookings</T>
                      </Text>
                      <Text className="mt-1 text-lg font-bold text-amber-900">
                        {pendingBookings.length}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </Animated.View>
          ) : null}
        </Animated.View>
      </SafeAreaView>

      {/* ── Bottom Panel ───────────────────────────────────────────── */}
      <BottomSheet
        ref={bottomSheetRef}
        index={initialSheetIndex}
        snapPoints={sheetSnapPoints}
        enablePanDownToClose
        onChange={handleSheetChange}
        onAnimate={handleSheetAnimate}
        handleIndicatorStyle={{ backgroundColor: "#CBD5E1", width: 44 }}
        backgroundStyle={{ backgroundColor: "#FFFFFF", borderRadius: 28 }}
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          zIndex: 60,
        }}
      >
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#042F40"
            />
          }
        >
          <SafeAreaView edges={["bottom"]} className="-pb-2">
            <Animated.View
              entering={FadeInUp.delay(220).duration(400)}
              className="mx-5 mb-4 rounded-[26px] bg-[#042F40] px-4 py-4"
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D4A017]">
                    Driver Mode
                  </Text>
                  <Text className="mt-1 text-lg font-bold text-white">
                    {isOnline ? <T>Ready for new passengers</T> : <T>Offline and resting</T>}
                  </Text>
                  <Text className="mt-1 text-xs leading-5 text-slate-300">
                    {isOnline ? (
                      <T>Live requests, passenger bookings, and active rides are flowing into this panel.</T>
                    ) : (
                      <T>Go live when you are ready to accept ride requests and appear on the map.</T>
                    )}
                  </Text>
                </View>
                <View className="rounded-2xl bg-white/10 px-3 py-2 items-center">
                  <Text className="text-[10px] uppercase tracking-[0.16em] text-slate-300">
                    Status
                  </Text>
                  <Text className="mt-1 text-sm font-bold text-white">
                    {isOnline ? <T>Online</T> : <T>Offline</T>}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleToggle}
                disabled={toggling}
                activeOpacity={0.9}
                className={`mt-4 rounded-2xl px-4 py-3 flex-row items-center justify-between ${isOnline ? "bg-emerald-500" : "bg-[#D4A017]"}`}
              >
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 rounded-full items-center justify-center bg-white/20 mr-3">
                    {toggling ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons
                        name={isOnline ? "radio" : "radio-outline"}
                        size={20}
                        color="#fff"
                      />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-white">
                      {isOnline ? <T>Tap to go offline</T> : <T>Go live now</T>}
                    </Text>
                    <Text className="text-[11px] text-white/80">
                      {isOnline ? (
                        <T>Passengers can currently discover and book your rides.</T>
                      ) : (
                        <T>Start receiving ride requests from nearby passengers.</T>
                      )}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </Animated.View>

            <Animated.View
              entering={FadeInUp.delay(320).duration(400)}
              className="mx-5 mb-5"
            >
              <Text className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <T>Operations Snapshot</T>
              </Text>
              <View className="flex-row gap-3">
                <View className="flex-1 rounded-2xl bg-slate-50 px-4 py-4">
                  <Text className="text-[11px] text-slate-500">
                    <T>Live rides</T>
                  </Text>
                  <Text className="mt-1 text-2xl font-bold text-slate-900">
                    {liveRideCount}
                  </Text>
                </View>
                <View className="flex-1 rounded-2xl bg-slate-50 px-4 py-4">
                  <Text className="text-[11px] text-slate-500">
                    <T>Queued requests</T>
                  </Text>
                  <Text className="mt-1 text-2xl font-bold text-slate-900">
                    {availableRequests.length}
                  </Text>
                </View>
              </View>
              <View className="mt-3 flex-row gap-3">
                <View className="flex-1 rounded-2xl bg-slate-50 px-4 py-4">
                  <Text className="text-[11px] text-slate-500">
                    <T>Pending bookings</T>
                  </Text>
                  <Text className="mt-1 text-2xl font-bold text-slate-900">
                    {pendingBookings.length}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push("/(drivers)/earnings" as any)}
                  className="flex-1 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4"
                  activeOpacity={0.8}
                >
                  <Text className="text-[11px] text-emerald-700">
                    <T>Earnings</T>
                  </Text>
                  <View className="mt-1 flex-row items-center justify-between">
                    <Text className="text-base font-bold text-emerald-800">
                      <T>View summary</T>
                    </Text>
                    <Ionicons
                      name="wallet-outline"
                      size={18}
                      color="#047857"
                    />
                  </View>
                </TouchableOpacity>
              </View>
              <View className="mt-3 rounded-2xl bg-slate-50 px-4 py-4">
                <Text className="text-[11px] text-slate-500">
                  <T>Scheduled and completed</T>
                </Text>
                <View className="mt-2 flex-row items-center">
                  <View className="mr-6">
                    <Text className="text-xl font-bold text-slate-900">
                      {idleRideCount}
                    </Text>
                    <Text className="text-[11px] text-slate-500">
                      <T>Waiting</T>
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xl font-bold text-slate-900">
                      {completedCount}
                    </Text>
                    <Text className="text-[11px] text-slate-500">
                      <T>Completed</T>
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>

            {isOnline && availableRequests.length > 0 && (
              <Animated.View
                entering={FadeInUp.delay(380).duration(400)}
                className="mx-5 mb-5"
              >
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.18em]">
                    <T>Ride Requests</T>
                  </Text>
                  {availableRequests.length > 3 ? (
                    <TouchableOpacity
                      onPress={() => router.push("/(drivers)/ride-requests")}
                      activeOpacity={0.8}
                    >
                      <Text className="text-xs font-semibold text-primary">
                        <T>View all requests</T>
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {availableRequests.slice(0, 3).map((req) => {
                  const pickup =
                    typeof req.pickup_location_id === "object"
                      ? req.pickup_location_id
                      : null;
                  const dest =
                    typeof req.destination_id === "object"
                      ? req.destination_id
                      : null;
                  return (
                    <TouchableOpacity
                      key={req._id}
                      onPress={() => {
                        if (!isOnline) {
                          Alert.alert(
                            "Go Online First",
                            "You must be online to accept ride requests.",
                          );
                          return;
                        }
                        router.push({
                          pathname: "/(drivers)/ride-details" as any,
                          params: { rideId: req._id },
                        });
                      }}
                      className="bg-white rounded-2xl p-4 mb-2.5 flex-row items-center border border-slate-200"
                    >
                      <View className="w-10 h-10 rounded-2xl bg-violet-100 items-center justify-center mr-3">
                        <Ionicons name="hand-right" size={14} color="#7C3AED" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-gray-800">
                          {pickup?.short_name || pickup?.name || "Pickup"} →{" "}
                          {dest?.short_name || dest?.name || "Destination"}
                        </Text>
                        <Text className="text-[11px] text-gray-400 mt-1">
                          {req.available_seats} seats · ₦{req.fare} · <T>Open request</T>
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color="#7C3AED"
                      />
                    </TouchableOpacity>
                  );
                })}
              </Animated.View>
            )}

            {/* Pending Bookings */}
            {isOnline && pendingBookings.length > 0 && (
              <Animated.View
                entering={FadeInUp.delay(440).duration(400)}
                className="mx-5 mb-5"
              >
                <Text className="text-[11px] font-semibold text-gray-400 uppercase mb-2 tracking-[0.18em]">
                  <T>Pending Bookings</T>
                </Text>
                {pendingBookings.slice(0, 3).map((bk) => {
                  const usr =
                    bk.user_id && typeof bk.user_id === "object"
                      ? bk.user_id
                      : null;
                  return (
                    <TouchableOpacity
                      key={bk._id}
                      onPress={() => {
                        if (!isOnline) {
                          Alert.alert(
                            "Go Online First",
                            "You must be online to manage bookings.",
                          );
                          return;
                        }
                        router.push({
                          pathname: "/(drivers)/ride-details" as any,
                          params: { bookingId: bk._id },
                        });
                      }}
                      className="bg-white rounded-2xl p-4 mb-2.5 flex-row items-center border border-slate-200"
                    >
                      <View className="w-10 h-10 rounded-2xl bg-amber-50 items-center justify-center mr-3">
                        <Ionicons name="person" size={14} color="#D4A017" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-gray-800">
                          {usr?.name || "Passenger"}
                        </Text>
                        <Text className="text-[11px] text-gray-400 mt-1">
                          {bk.seats_requested} seat
                          {bk.seats_requested > 1 ? "s" : ""} ·{" "}
                          {bk.payment_method}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color="#D4A017"
                      />
                    </TouchableOpacity>
                  );
                })}
              </Animated.View>
            )}

            {/* Active Rides */}
            {isOnline && activeRides.length > 0 && (
              <Animated.View
                entering={FadeInUp.delay(500).duration(400)}
                className="mx-5 mb-4"
              >
                <Text className="text-[11px] font-semibold text-gray-400 uppercase mb-2 tracking-[0.18em]">
                  <T>Your Rides</T>
                </Text>
                {activeRides.slice(0, 3).map((ride) => {
                  const pickup =
                    typeof ride.pickup_location_id === "object"
                      ? ride.pickup_location_id
                      : null;
                  const dest =
                    typeof ride.destination_id === "object"
                      ? ride.destination_id
                      : null;
                  const isLive = ride.status === "in_progress";
                  return (
                    <TouchableOpacity
                      key={ride._id}
                      onPress={() =>
                        isLive
                          ? router.push({
                              pathname: "/(drivers)/active-ride" as any,
                              params: { rideId: ride._id },
                            })
                          : router.push({
                              pathname: "/(drivers)/ride-details" as any,
                              params: { rideId: ride._id },
                            })
                      }
                      className={`rounded-2xl p-4 mb-2.5 flex-row items-center border ${isLive ? "bg-blue-50 border-blue-100" : "bg-white border-slate-200"}`}
                    >
                      <View
                        className={`w-10 h-10 rounded-2xl items-center justify-center mr-3 ${isLive ? "bg-blue-100" : "bg-slate-100"}`}
                      >
                        <Ionicons
                          name={isLive ? "navigate" : "car"}
                          size={14}
                          color={isLive ? "#2563EB" : "#042F40"}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-gray-800">
                          {pickup?.short_name || "Pickup"} →{" "}
                          {dest?.short_name || "Destination"}
                        </Text>
                        <Text className="text-[11px] text-gray-400 capitalize mt-1">
                          {ride.status.replace("_", " ")} · {ride.booked_seats}/
                          {ride.available_seats} seats
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={isLive ? "#2563EB" : "#9CA3AF"}
                      />
                    </TouchableOpacity>
                  );
                })}
              </Animated.View>
            )}

            {/* Quick Actions */}
            <Animated.View
              entering={FadeInUp.delay(560).duration(400)}
              className="mx-5 gap-3 mb-2"
            >
              <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <T>Driver tools</T>
              </Text>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={openCreateRide}
                  className={`flex-1 rounded-2xl py-4 items-center flex-row justify-center ${isOnline ? "bg-primary" : "bg-gray-300"}`}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#fff" />
                  <Text className="text-white font-bold text-sm ml-2">
                    <T>Create Ride</T>
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push("/(drivers)/rides")}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white py-4 items-center flex-row justify-center"
                >
                  <Ionicons name="list-outline" size={18} color="#042F40" />
                  <Text className="text-gray-700 font-bold text-sm ml-2">
                    <T>All Rides</T>
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </SafeAreaView>
        </BottomSheetScrollView>
      </BottomSheet>

      {sheetHidden ? (
        <SafeAreaView
          edges={["bottom"]}
          className="absolute bottom-4 right-5 z-30"
          pointerEvents="box-none"
        >
          <TouchableOpacity
            onPress={openSheet}
            className="flex-row items-center rounded-full bg-[#042F40] px-4 py-3"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.18,
              shadowRadius: 16,
            }}
          >
            <Ionicons name="chevron-up" size={18} color="#fff" />
            <Text className="ml-1.5 text-sm font-semibold text-white">
              <T>Open panel</T>
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      ) : null}

      <LanguageOnboarding />
    </View>
  );
}
