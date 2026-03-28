import React, { useEffect, useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  BackHandler,
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
  Marker,
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
import { locationApi } from "@/lib/rideApi";

const CATEGORIES: Record<string, { label: string; icon: string }> = {
  academic: { label: "Academic", icon: "school" },
  hostel: { label: "Hostels", icon: "bed" },
  cafeteria: { label: "Cafeteria", icon: "restaurant" },
  admin_building: { label: "Admin", icon: "business" },
  religious: { label: "Religious", icon: "heart" },
  library: { label: "Library & ICT", icon: "library" },
  market: { label: "Markets", icon: "cart" },
  other: { label: "Other", icon: "location" },
};

export default function UserHomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  useReviewPrompt(!!user);
  const { onlineDrivers, fetchOnlineDrivers, userLocation } =
    useLocationStore();
  const {
    campusLocations,
    availableRides,
    fetchLocations,
    fetchGroupedLocations,
    fetchActiveRides,
    setSelectedPickup,
    setSelectedDestination,
    myBookings,
    fetchMyBookings,
    rateDriver,
  } = useRideStore();
  const { unreadCount, fetchNotifications } = useNotificationStore();
  const mapsEnabled = usePlatformSettingsStore(
    (state) => state.settings.expo_maps_enabled,
  );
  const safeMode = useBootstrapStore((state) => state.safeMode);
  const { requestPermission, startWatching, getCurrentLocation } =
    useLocation();
  const {
    connect,
    joinLiveMap,
    joinRoom,
    joinUserFeed,
    streamPassengerLocation,
  } = useSocket();

  const cameraRef = useRef<{ setCamera: (opts: any) => void }>(null);
  const hasCentered = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mapType, setMapType] = useState<"hybrid" | "standard">("hybrid");
  const [allowMapCanvas, setAllowMapCanvas] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [ratingVal, setRatingVal] = useState(0);
  const [ratingText, setRatingText] = useState("");
  const [ratingBookingId, setRatingBookingId] = useState<string | null>(null);
  const [sheetHidden, setSheetHidden] = useState(false);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [showTopOverlayCards, setShowTopOverlayCards] = useState(true);
  const skippedRatings = useRef<Set<string>>(new Set());
  const bottomSheetRef = useRef<BottomSheet>(null);

  // ── Init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) {
        setAllowMapCanvas(Boolean(mapsEnabled) && !safeMode);
      }
    });

    recordBootstrapTrace(
      "user-home:mount",
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
        if (!safeMode) {
          await connect();
          if (user) {
            joinRoom(user.id, user.role);
            joinUserFeed(user.id);
          }
          joinLiveMap();
        }
      } catch (e) {
        console.warn("Init error:", e);
      }
      try {
        fetchOnlineDrivers();
        fetchLocations();
        fetchGroupedLocations();
        fetchActiveRides();
        fetchMyBookings();
        fetchNotifications();
      } catch (e) {
        console.warn("Data fetch init error:", e);
      }
    })();
    const ivDrivers = setInterval(() => fetchOnlineDrivers(), 30000);
    const ivData = setInterval(() => {
      fetchMyBookings();
      fetchActiveRides();
    }, 8000);
    return () => {
      cancelled = true;
      interactionHandle.cancel();
      clearInterval(ivDrivers);
      clearInterval(ivData);
    };
  }, [mapsEnabled, safeMode]);

  useFocusEffect(
    useCallback(() => {
      fetchMyBookings();
      fetchActiveRides();
      fetchNotifications();
    }, []),
  );

  // ── Socket events: real-time updates ──────────────────────────────
  useEffect(() => {
    const refresh = () => {
      fetchMyBookings();
      fetchActiveRides();
      fetchNotifications();
    };
    const u1 = eventBus.on("booking:updated", refresh);
    const u2 = eventBus.on("booking:cancelled", refresh);
    const u3 = eventBus.on("booking:checkin", refresh);
    const u4 = eventBus.on("ride:accepted", refresh);
    const u5 = eventBus.on("ride:ended", refresh);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, []);

  // ── Stream passenger location for active rides ────────────────────
  useEffect(() => {
    const activeBooking = myBookings.find(
      (b) => b.status === "in_progress" || b.status === "accepted",
    );
    if (!activeBooking || !user || !userLocation) return;

    const rId =
      typeof activeBooking.ride_id === "object"
        ? activeBooking.ride_id._id
        : activeBooking.ride_id;

    const iv = setInterval(() => {
      const loc = useLocationStore.getState().userLocation;
      if (loc && rId) {
        streamPassengerLocation(
          user.id,
          rId,
          loc.latitude,
          loc.longitude,
          user.name,
          user.profile_picture || null,
        );
        locationApi
          .updateUserLocation({
            latitude: loc.latitude,
            longitude: loc.longitude,
          })
          .catch(() => {});
      }
    }, 5000);

    return () => clearInterval(iv);
  }, [myBookings, user, userLocation]);

  // ── Derived ───────────────────────────────────────────────────────────
  const popularLocs = campusLocations.filter((l) => l.is_popular);
  const activeBookings = myBookings.filter(
    (b) =>
      b.status === "pending" ||
      b.status === "accepted" ||
      b.status === "in_progress",
  );
  const currentPriorityBooking =
    activeBookings.find((b) => b.status === "in_progress") ||
    activeBookings.find((b) => b.status === "accepted") ||
    null;

  const firstName = user?.name?.split(" ")[0] || "User";
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  // ── Rating ────────────────────────────────────────────────────────────
  useEffect(() => {
    const found = myBookings.find(
      (b) =>
        b.status === "completed" &&
        !b.rating &&
        !ratingBookingId &&
        !skippedRatings.current.has(b._id),
    );
    if (found) {
      setRatingBookingId(found._id);
      setShowRating(true);
    }
  }, [myBookings]);

  const submitRating = async () => {
    if (!ratingBookingId || ratingVal === 0) return;
    try {
      await rateDriver(ratingBookingId, ratingVal, ratingText);
      setShowRating(false);
      setRatingVal(0);
      setRatingText("");
      setRatingBookingId(null);
      fetchMyBookings();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed");
    }
  };
  const skipRating = () => {
    if (ratingBookingId) skippedRatings.current.add(ratingBookingId);
    setShowRating(false);
    setRatingBookingId(null);
    setRatingVal(0);
    setRatingText("");
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchOnlineDrivers(),
      fetchActiveRides(),
      fetchMyBookings(),
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

  const showMapCanvas = mapsEnabled && allowMapCanvas && !safeMode;
  const sheetSnapPoints = React.useMemo(
    () => (showMapCanvas ? ["18%", "46%", "82%"] : ["36%", "64%", "90%"]),
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
    bottomSheetRef.current?.snapToIndex(
      Math.min(1, sheetSnapPoints.length - 1),
    );
  }, [sheetSnapPoints.length]);

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
                : [4.52, 7.52],
              zoomLevel: 14,
            }}
            animationDuration={1500}
          />
          <LocationPuck />
          {onlineDrivers
            .filter((driver) => driver.location)
            .map((driver) => (
              <Marker
                key={driver.driver_id}
                coordinate={{
                  latitude: driver.location!.latitude,
                  longitude: driver.location!.longitude,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View className="items-center">
                  <Image
                    source={require("@/assets/images/car-marker.png")}
                    style={{
                      width: 36,
                      height: 36,
                      transform: [{ rotate: `${driver.heading || 0}deg` }],
                    }}
                    resizeMode="contain"
                  />
                  <View className="mt-1 rounded-full bg-white/95 px-2 py-0.5">
                    <Text className="text-[10px] font-semibold text-gray-700">
                      {driver.name?.split(" ")[0] || "Driver"} ·{" "}
                      {driver.available_seats || 0} seat
                      {driver.available_seats === 1 ? "" : "s"}
                    </Text>
                  </View>
                </View>
              </Marker>
            ))}
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
                    You can still browse rides, manage bookings, and keep your
                    trip moving from the panel below while maps are unavailable.
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
              onPress={() => router.push("/(users)/profile")}
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
                  <Text className="text-white font-bold text-xs">
                    {initials}
                  </Text>
                </View>
              )}
              <View className="ml-2.5">
                <Text className="text-[10px] text-gray-400">
                  <T>Passenger</T>
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
                onPress={() => router.push("/(users)/notifications")}
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

          {currentPriorityBooking && showTopOverlayCards ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              exiting={FadeOutUp.duration(220)}
            >
              <TouchableOpacity
                onPress={() =>
                  router.push(
                    (currentPriorityBooking.status === "in_progress"
                      ? "/(users)/active-ride"
                      : {
                          pathname: "/(users)/ride-details",
                          params: { bookingId: currentPriorityBooking._id },
                        }) as any,
                  )
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
                      currentPriorityBooking.status === "in_progress"
                        ? "navigate"
                        : "ticket-outline"
                    }
                    size={18}
                    color="#fff"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] uppercase tracking-[0.16em] text-white/70">
                    <T>Current booking</T>
                  </Text>
                  <Text className="mt-1 text-sm font-bold text-white">
                    {currentPriorityBooking.status === "in_progress" ? (
                      <T>Open live ride</T>
                    ) : (
                      <T>Open accepted booking</T>
                    )}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </Animated.View>
          ) : null}

          {(activeBookings.length > 0 || availableRides.length > 0) &&
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
                      <T>Today on campus</T>
                    </Text>
                    <Text className="mt-1 text-sm font-bold text-slate-900">
                      {activeBookings.length > 0 ? (
                        <T>Your booking updates are ready</T>
                      ) : (
                        <T>Fresh rides are available nearby</T>
                      )}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      activeBookings.length > 0
                        ? router.push("/(users)/activity")
                        : router.push("/(users)/available-rides" as any)
                    }
                    className="rounded-full bg-[#042F40] px-4 py-2.5"
                    activeOpacity={0.9}
                  >
                    <Text className="text-xs font-semibold text-white">
                      {activeBookings.length > 0 ? (
                        <T>View bookings</T>
                      ) : (
                        <T>Browse rides</T>
                      )}
                    </Text>
                  </TouchableOpacity>
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
          zIndex: 50,
        }}
      >
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={{ paddingBottom: 28 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#042F40"
            />
          }
        >
          <SafeAreaView edges={["bottom"]} className="pb-2">
            <Animated.View
              entering={FadeInUp.delay(220).duration(400)}
              className="mx-5 mb-4 rounded-[26px] bg-[#042F40] px-4 py-4"
            >
              <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D4A017]">
                Rider Console
              </Text>
              <Text className="mt-1 text-lg font-bold text-white">
                {activeBookings.length > 0 ? (
                  <T>Your next ride is within reach</T>
                ) : (
                  <T>Ready to request your next trip</T>
                )}
              </Text>
              <Text className="mt-1 text-xs leading-5 text-slate-300">
                {activeBookings.length > 0 ? (
                  <T>
                    Track active bookings, check in quickly, and keep your trip
                    details close.
                  </T>
                ) : (
                  <T>
                    Search routes, browse live rides, and get picked up faster
                    from your most-used stops.
                  </T>
                )}
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(users)/search-ride" as any)}
                className="mt-4 flex-row items-center rounded-2xl bg-[#D4A017] px-4 py-3"
                activeOpacity={0.9}
              >
                <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-3">
                  <Ionicons name="search" size={18} color="#fff" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-white">
                    <T>Plan a ride</T>
                  </Text>
                  <Text className="text-[11px] text-white/80">
                    <T>
                      Search pickup and destination locations across campus.
                    </T>
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(300).duration(400)}>
              <View className="mx-5 mb-5 rounded-[24px] bg-slate-50 px-4 py-4">
                <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  <T>Live snapshot</T>
                </Text>
                <View className="mt-3 flex-row gap-3">
                  <View className="flex-1 rounded-2xl bg-white px-4 py-4">
                    <Text className="text-[11px] text-slate-500">
                      <T>Drivers online</T>
                    </Text>
                    <Text className="mt-1 text-2xl font-bold text-slate-900">
                      {onlineDrivers.length}
                    </Text>
                  </View>
                  <View className="flex-1 rounded-2xl bg-white px-4 py-4">
                    <Text className="text-[11px] text-slate-500">
                      <T>Open rides</T>
                    </Text>
                    <Text className="mt-1 text-2xl font-bold text-slate-900">
                      {availableRides.length}
                    </Text>
                  </View>
                </View>
                <View className="mt-3 flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => router.push("/(users)/activity")}
                    className="flex-1 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4"
                    activeOpacity={0.8}
                  >
                    <Text className="text-[11px] text-amber-700">
                      <T>My bookings</T>
                    </Text>
                    <Text className="mt-1 text-base font-bold text-amber-800">
                      {activeBookings.length > 0 ? activeBookings.length : 0}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      router.push("/(users)/available-rides" as any)
                    }
                    className="flex-1 rounded-2xl border border-primary/10 bg-primary/5 px-4 py-4"
                    activeOpacity={0.8}
                  >
                    <Text className="text-[11px] text-primary">
                      <T>Browse rides</T>
                    </Text>
                    <Text className="mt-1 text-base font-bold text-primary">
                      <T>View now</T>
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>

            {popularLocs.length > 0 && (
              <Animated.View entering={FadeInUp.delay(380).duration(400)}>
                <Text className="mx-5 mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  <T>Quick destinations</T>
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="px-5 mb-4"
                >
                  {popularLocs.slice(0, 8).map((loc) => (
                    <TouchableOpacity
                      key={loc._id}
                      onPress={() => {
                        setSelectedDestination(loc);
                        router.push("/(users)/search-ride" as any);
                      }}
                      className="mr-2 rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 flex-row items-center"
                    >
                      <Ionicons
                        name={
                          (CATEGORIES[loc.category]?.icon || "location") as any
                        }
                        size={13}
                        color="#042F40"
                      />
                      <Text
                        className="text-xs font-medium text-gray-700 ml-2"
                        numberOfLines={1}
                      >
                        {loc.short_name || loc.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Animated.View>
            )}

            {/* Active Booking */}
            {activeBookings.slice(0, 1).map((bk) => {
              const needsCheckIn =
                bk.status === "accepted" && bk.check_in_status !== "checked_in";
              const isCheckedInWaiting =
                bk.check_in_status === "checked_in" &&
                bk.status !== "in_progress";
              const inProg = bk.status === "in_progress";
              return (
                <Animated.View
                  key={bk._id}
                  entering={FadeInUp.delay(520).duration(400)}
                  className="mx-5 mb-4"
                >
                  <TouchableOpacity
                    onPress={() =>
                      inProg
                        ? router.push("/(users)/active-ride" as any)
                        : router.push({
                            pathname: "/(users)/ride-details" as any,
                            params: { bookingId: bk._id },
                          })
                    }
                    className={`rounded-[24px] p-4 ${needsCheckIn ? "bg-accent/10 border border-accent/20" : isCheckedInWaiting ? "bg-green-50 border border-green-100" : inProg ? "bg-blue-50 border border-blue-100" : "bg-green-50 border border-green-100"}`}
                  >
                    <View className="flex-row items-center">
                      <View
                        className={`w-10 h-10 rounded-full items-center justify-center ${needsCheckIn ? "bg-accent/20" : isCheckedInWaiting ? "bg-green-100" : inProg ? "bg-blue-100" : "bg-green-100"}`}
                      >
                        <Ionicons
                          name={
                            inProg
                              ? "navigate"
                              : needsCheckIn
                                ? "key"
                                : isCheckedInWaiting
                                  ? "hourglass"
                                  : "checkmark-circle"
                          }
                          size={20}
                          color={
                            needsCheckIn
                              ? "#D4A017"
                              : isCheckedInWaiting
                                ? "#16A34A"
                                : inProg
                                  ? "#2563EB"
                                  : "#16A34A"
                          }
                        />
                      </View>
                      <View className="flex-1 ml-3">
                        <Text className="text-sm font-semibold text-gray-900">
                          {bk.status === "pending" ? (
                            <T>Booking Pending</T>
                          ) : needsCheckIn ? (
                            <T>Check In Required</T>
                          ) : isCheckedInWaiting ? (
                            <T>Checked In</T>
                          ) : inProg ? (
                            <T>Ride In Progress</T>
                          ) : (
                            <T>Booking Confirmed</T>
                          )}
                        </Text>
                        <Text className="text-xs text-gray-500 mt-0.5">
                          {needsCheckIn && bk.check_in_code ? (
                            <T>Tap to check in with your code</T>
                          ) : needsCheckIn ? (
                            <T>Waiting for check-in code</T>
                          ) : isCheckedInWaiting ? (
                            <T>Waiting for the driver to start</T>
                          ) : (
                            <T>Tap to view details</T>
                          )}
                        </Text>
                      </View>
                      {needsCheckIn && bk.check_in_code ? (
                        <View className="bg-accent/20 rounded-xl px-3 py-1.5">
                          <Text className="text-xs font-bold text-accent tracking-widest">
                            {bk.check_in_code}
                          </Text>
                        </View>
                      ) : (
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color="#9CA3AF"
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}

            <View className="mx-5 mb-1 flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
              <Text className="text-xs text-gray-400">
                {onlineDrivers.length}{" "}
                <T>
                  {onlineDrivers.length === 1
                    ? "driver nearby"
                    : "drivers nearby"}
                </T>
              </Text>
            </View>
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

      {/* ── Rating Modal ───────────────────────────────────────────── */}
      <Modal
        visible={showRating}
        transparent
        onRequestClose={skipRating}
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <Animated.View
            className="w-full rounded-[32px] bg-white p-6"
           
          >
            <Pressable
              onPress={skipRating}
              className="absolute right-4 top-4 z-10 h-8 w-8 items-center justify-center rounded-full bg-gray-100"
            >
              <Ionicons name="close" size={18} color="#6B7280" />
            </Pressable>
            <View className="mb-5 items-center">
              <View className="mb-3 h-16 w-16 items-center justify-center rounded-full bg-accent/10">
                <Ionicons name="star" size={30} color="#D4A017" />
              </View>
              <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                <T>Trip Feedback</T>
              </Text>
              <Text className="mt-2 text-xl font-bold text-gray-900">
                <T>Rate Your Ride</T>
              </Text>
              <Text className="mt-1 text-sm text-gray-500">
                <T>How was your experience with this completed ride?</T>
              </Text>
            </View>
            <View className="mb-5 rounded-[24px] bg-slate-50 px-4 py-4">
              <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                <T>Your Rating</T>
              </Text>
              <View className="mt-4 flex-row justify-center">
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setRatingVal(s)}
                  className="mx-1.5"
                >
                  <Ionicons
                    name={s <= ratingVal ? "star" : "star-outline"}
                    size={40}
                    color={s <= ratingVal ? "#D4A017" : "#D1D5DB"}
                  />
                </TouchableOpacity>
              ))}
              </View>
              <Text className="mt-3 text-center text-xs text-slate-500">
                {ratingVal === 0 ? (
                  <T>Select a rating to continue</T>
                ) : ratingVal <= 2 ? (
                  <T>We are sorry this trip missed the mark.</T>
                ) : ratingVal === 3 ? (
                  <T>Thanks. Your feedback helps us improve.</T>
                ) : (
                  <T>Great to hear. Thanks for riding with UniRide.</T>
                )}
              </Text>
            </View>
            <TextInput
              value={ratingText}
              onChangeText={setRatingText}
              placeholder="Feedback (optional)"
              placeholderTextColor="#9CA3AF"
              multiline
              className="mb-5 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-800"
              style={{ minHeight: 88, textAlignVertical: "top" }}
            />
            <TouchableOpacity
              onPress={submitRating}
              disabled={ratingVal === 0}
              className={`items-center rounded-2xl py-4 ${ratingVal > 0 ? "bg-primary" : "bg-gray-200"}`}
            >
              <Text
                className={`font-bold text-base ${ratingVal > 0 ? "text-white" : "text-gray-400"}`}
              >
                <T>Submit Rating</T>
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={skipRating}
              className="mt-3 items-center py-2"
            >
              <Text className="text-sm text-gray-400">
                <T>Maybe Later</T>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}
