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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Mapbox, {
  MapView,
  Camera,
  LocationPuck,
} from "@/components/map/MapboxWrapper";
import Animated, { FadeInUp, SlideInUp } from "react-native-reanimated";

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

const MAPBOX_TOKEN =
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  "find_your_own_token_at_mapbox.com_and_put_it_here";
Mapbox.setAccessToken(MAPBOX_TOKEN);

export default function DriverHomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  useReviewPrompt(!!user);
  const {
    userLocation,
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
  const { unreadCount, fetchNotifications, startPolling, stopPolling } =
    useNotificationStore();
  const { requestPermission, startWatching, getCurrentLocation } =
    useLocation();
  const { connect, joinRoom, joinDriverFeed, joinLiveMap } = useSocket();

  const cameraRef = useRef<{ setCamera: (opts: any) => void }>(null);
  const hasCentered = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const locationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

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
    (async () => {
      try {
        const ok = await requestPermission();
        if (ok) {
          startWatching();
          await getCurrentLocation();
        }
      } catch (e) {
        console.warn("Location init error:", e);
      }
      try {
        await connect();
        if (user) {
          joinRoom(user.id, user.role);
          joinDriverFeed();
        }
        joinLiveMap();
      } catch (e) {
        console.warn("Socket init error:", e);
      }
      try {
        fetchDriverRides();
        fetchDriverBookings();
        fetchAvailableRequests();
        fetchNotifications();
        startPolling(30000);
      } catch (e) {
        console.warn("Data fetch init error:", e);
      }
      // Restore persistent online state if driver was online before
      try {
        restoreOnlineState();
      } catch {}
    })();
    return () => {
      if (locationInterval.current) clearInterval(locationInterval.current);
      stopPolling();
    };
  }, []);

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
    if (isOnline && userLocation) {
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
  }, [isOnline, userLocation]);

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

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <View className="flex-1 bg-white">
      {/* ── Full-Screen Map ────────────────────────────────────────── */}
      <MapView
        style={{ flex: 1 }}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: userLocation
              ? [userLocation.longitude, userLocation.latitude]
              : [4.52, 7.52],
            zoomLevel: 14,
            pitch: 45,
          }}
          animationMode="flyTo"
          animationDuration={1500}
        />
        <LocationPuck
          puckBearingEnabled
          puckBearing="heading"
          pulsing={{
            isEnabled: true,
            color: isOnline ? "#16A34A" : "#042F40",
            radius: 60,
          }}
        />
      </MapView>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <SafeAreaView
        edges={["top"]}
        className="absolute top-0 left-0 right-0 z-10"
        pointerEvents="box-none"
      >
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          className="mx-5 mt-2 flex-row items-center justify-between"
        >
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
        </Animated.View>
      </SafeAreaView>

      {/* ── Bottom Panel ───────────────────────────────────────────── */}
      <Animated.View
        className="absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-[28px]"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          maxHeight: "55%",
        }}
      >
        <View className="items-center pt-3 pb-1">
          <View className="w-10 h-1 bg-gray-200 rounded-full" />
        </View>
        <ScrollView
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
          <SafeAreaView edges={["bottom"]} className="pb-2">
            {/* Online Toggle */}
            <Animated.View
              entering={FadeInUp.delay(300).duration(400)}
              className="mx-5 mb-4"
            >
              <TouchableOpacity
                onPress={handleToggle}
                disabled={toggling}
                activeOpacity={0.8}
                className={`rounded-2xl p-4 flex-row items-center justify-between ${isOnline ? "bg-green-50 border border-green-100" : "bg-gray-50 border border-gray-100"}`}
              >
                <View className="flex-row items-center flex-1">
                  <View
                    className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isOnline ? "bg-green-100" : "bg-gray-200"}`}
                  >
                    {toggling ? (
                      <ActivityIndicator
                        size="small"
                        color={isOnline ? "#16A34A" : "#6B7280"}
                      />
                    ) : (
                      <Ionicons
                        name={isOnline ? "radio" : "radio-outline"}
                        size={20}
                        color={isOnline ? "#16A34A" : "#6B7280"}
                      />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-gray-900">
                      {isOnline ? <T>You're Online</T> : <T>You're Offline</T>}
                    </Text>
                    <Text className="text-xs text-gray-400">
                      {isOnline ? (
                        <T>Visible to passengers · Tap to go offline</T>
                      ) : (
                        <T>Tap to go online and receive rides</T>
                      )}
                    </Text>
                  </View>
                </View>
                {toggling ? (
                  <View
                    className={`rounded-full px-4 py-2 flex-row items-center gap-1.5 ${isOnline ? "bg-green-500" : "bg-primary"}`}
                  >
                    <ActivityIndicator size="small" color="#fff" />
                    <Text className="text-xs font-bold text-white">
                      {isOnline ? (
                        <T>Going Offline...</T>
                      ) : (
                        <T>Going Live...</T>
                      )}
                    </Text>
                  </View>
                ) : (
                  <View
                    className={`rounded-full px-4 py-2 ${isOnline ? "bg-green-500" : "bg-primary"}`}
                  >
                    <Text className="text-xs font-bold text-white">
                      {isOnline ? <T>Online</T> : <T>Go Live</T>}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Stats */}
            <Animated.View
              entering={FadeInUp.delay(400).duration(400)}
              className="flex-row mx-5 mb-4 gap-3"
            >
              <View className="flex-1 bg-primary/5 rounded-2xl p-3 items-center">
                <Text className="text-2xl font-bold text-primary">
                  {activeRides.length}
                </Text>
                <Text className="text-[11px] text-gray-500 mt-0.5">
                  <T>Active</T>
                </Text>
              </View>
              <View className="flex-1 bg-accent/5 rounded-2xl p-3 items-center">
                <Text className="text-2xl font-bold text-accent">
                  {pendingBookings.length}
                </Text>
                <Text className="text-[11px] text-gray-500 mt-0.5">
                  <T>Pending</T>
                </Text>
              </View>
              <View className="flex-1 bg-gray-50 rounded-2xl p-3 items-center">
                <Text className="text-2xl font-bold text-gray-700">
                  {completedCount}
                </Text>
                <Text className="text-[11px] text-gray-500 mt-0.5">
                  <T>Completed</T>
                </Text>
              </View>
            </Animated.View>

            {/* Ride Requests (user-created rides needing a driver) */}
            {isOnline && availableRequests.length > 0 && (
              <Animated.View
                entering={FadeInUp.delay(450).duration(400)}
                className="mx-5 mb-4"
              >
                <Text className="text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">
                  <T>Ride Requests</T>
                </Text>
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
                      className="bg-purple-50 rounded-xl p-3 mb-2 flex-row items-center border border-purple-100"
                    >
                      <View className="w-8 h-8 rounded-full bg-purple-100 items-center justify-center mr-3">
                        <Ionicons name="hand-right" size={14} color="#7C3AED" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-gray-800">
                          {pickup?.short_name || pickup?.name || "Pickup"} →{" "}
                          {dest?.short_name || dest?.name || "Destination"}
                        </Text>
                        <Text className="text-[10px] text-gray-400">
                          {req.available_seats} seats · ₦{req.fare}
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
                entering={FadeInUp.delay(500).duration(400)}
                className="mx-5 mb-4"
              >
                <Text className="text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">
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
                      className="bg-accent/5 rounded-xl p-3 mb-2 flex-row items-center border border-accent/10"
                    >
                      <View className="w-8 h-8 rounded-full bg-accent/10 items-center justify-center mr-3">
                        <Ionicons name="person" size={14} color="#D4A017" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-gray-800">
                          {usr?.name || "Passenger"}
                        </Text>
                        <Text className="text-[10px] text-gray-400">
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
                entering={FadeInUp.delay(550).duration(400)}
                className="mx-5 mb-3"
              >
                <Text className="text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">
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
                      className={`rounded-xl p-3 mb-2 flex-row items-center border ${isLive ? "bg-blue-50 border-blue-100" : "bg-gray-50 border-gray-100"}`}
                    >
                      <View
                        className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${isLive ? "bg-blue-100" : "bg-gray-200"}`}
                      >
                        <Ionicons
                          name={isLive ? "navigate" : "car"}
                          size={14}
                          color={isLive ? "#2563EB" : "#042F40"}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-gray-800">
                          {pickup?.short_name || "Pickup"} →{" "}
                          {dest?.short_name || "Destination"}
                        </Text>
                        <Text className="text-[10px] text-gray-400 capitalize">
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
              entering={FadeInUp.delay(600).duration(400)}
              className="flex-row mx-5 gap-3 mb-2"
            >
              <TouchableOpacity
                onPress={() => {
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
                }}
                className={`flex-1 rounded-2xl py-4 items-center flex-row justify-center ${isOnline ? "bg-primary" : "bg-gray-300"}`}
              >
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text className="text-white font-bold text-sm ml-2">
                  <T>Create Ride</T>
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/(drivers)/rides")}
                className="flex-1 bg-gray-100 rounded-2xl py-4 items-center flex-row justify-center"
              >
                <Ionicons name="list-outline" size={18} color="#042F40" />
                <Text className="text-gray-700 font-bold text-sm ml-2">
                  <T>All Rides</T>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </SafeAreaView>
        </ScrollView>
      </Animated.View>

      <LanguageOnboarding />
    </View>
  );
}
