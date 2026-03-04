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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Mapbox, {
  MapView,
  Camera,
  ShapeSource,
  SymbolLayer,
  Images,
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
  const { unreadCount, fetchNotifications, startPolling, stopPolling } =
    useNotificationStore();
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
  const [showRating, setShowRating] = useState(false);
  const [ratingVal, setRatingVal] = useState(0);
  const [ratingText, setRatingText] = useState("");
  const [ratingBookingId, setRatingBookingId] = useState<string | null>(null);
  const skippedRatings = useRef<Set<string>>(new Set());

  // ── Init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const ok = await requestPermission();
        if (ok) {
          startWatching();
          await getCurrentLocation();
        }
        await connect();
        if (user) {
          joinRoom(user.id, user.role);
          joinUserFeed(user.id);
        }
        joinLiveMap();
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
        startPolling(30000);
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
      clearInterval(ivDrivers);
      clearInterval(ivData);
      stopPolling();
    };
  }, []);

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
      }
    }, 5000);

    return () => clearInterval(iv);
  }, [myBookings, user, userLocation]);

  // ── Derived ───────────────────────────────────────────────────────────
  const driversGeo = {
    type: "FeatureCollection" as const,
    features: onlineDrivers
      .filter((d) => d.location)
      .map((d) => ({
        type: "Feature" as const,
        id: d.driver_id,
        geometry: {
          type: "Point" as const,
          coordinates: [d.location!.longitude, d.location!.latitude],
        },
        properties: { heading: d.heading || 0, icon: "car-marker" },
      })),
  };

  const popularLocs = campusLocations.filter((l) => l.is_popular);
  const activeBookings = myBookings.filter(
    (b) =>
      b.status === "pending" ||
      b.status === "accepted" ||
      b.status === "in_progress",
  );

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

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <View className="flex-1 bg-white">
      {/* ── Full-Screen Map ────────────────────────────────────────── */}
      <MapView
        style={{ flex: 1 }}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        compassEnabled
        compassPosition={{ top: 120, right: 16 }}
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
          pulsing={{ isEnabled: true, color: "#042F40", radius: 60 }}
        />
        {onlineDrivers.length > 0 && (
          <>
            <Images
              images={{
                "car-marker": require("@/assets/images/car-marker.png"),
              }}
            />
            <ShapeSource id="drivers" shape={driversGeo}>
              <SymbolLayer
                id="driver-icons"
                style={{
                  iconImage: "car-marker",
                  iconSize: 0.35,
                  iconAllowOverlap: true,
                  iconRotate: ["get", "heading"],
                  iconRotationAlignment: "map",
                  iconAnchor: "center",
                }}
              />
            </ShapeSource>
          </>
        )}
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
                <Text className="text-white font-bold text-xs">{initials}</Text>
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
          maxHeight: "48%",
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
            {/* Search */}
            <Animated.View entering={FadeInUp.delay(300).duration(400)}>
              <TouchableOpacity
                onPress={() => router.push("/(users)/search-ride" as any)}
                className="mx-5 mb-4 flex-row items-center bg-gray-50 rounded-2xl px-5 py-4"
                activeOpacity={0.8}
              >
                <View className="w-8 h-8 rounded-full bg-accent/10 items-center justify-center mr-3">
                  <Ionicons name="search" size={16} color="#D4A017" />
                </View>
                <Text className="flex-1 text-base text-gray-400">
                  <T>Where are you going?</T>
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </Animated.View>

            {/* Quick Locations */}
            {popularLocs.length > 0 && (
              <Animated.View entering={FadeInUp.delay(400).duration(400)}>
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
                      className="mr-2 bg-primary/5 rounded-xl px-4 py-2.5 flex-row items-center"
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

            {/* Stats */}
            <Animated.View
              entering={FadeInUp.delay(500).duration(400)}
              className="flex-row mx-5 mb-4 gap-3"
            >
              <TouchableOpacity
                onPress={() => {
                  setSelectedPickup(null);
                  setSelectedDestination(null);
                  fetchActiveRides();
                  router.push("/(users)/available-rides" as any);
                }}
                className="flex-1 bg-primary/5 rounded-2xl p-4 items-center"
              >
                <View className="w-11 h-11 rounded-full bg-primary/10 items-center justify-center mb-2">
                  <Ionicons name="car" size={22} color="#042F40" />
                </View>
                <Text className="text-xs font-semibold text-gray-700">
                  <T>Available Rides</T>
                </Text>
                <Text className="text-xl font-bold text-primary mt-0.5">
                  {availableRides.length}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/(users)/activity")}
                className="flex-1 bg-accent/5 rounded-2xl p-4 items-center"
              >
                <View className="w-11 h-11 rounded-full bg-accent/10 items-center justify-center mb-2">
                  <Ionicons name="time" size={22} color="#D4A017" />
                </View>
                <Text className="text-xs font-semibold text-gray-700">
                  <T>My Bookings</T>
                </Text>
                <Text className="text-xl font-bold text-accent mt-0.5">
                  {activeBookings.length > 0 ? (
                    activeBookings.length
                  ) : (
                    <T>View</T>
                  )}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Active Booking */}
            {activeBookings.slice(0, 1).map((bk) => {
              const needsCheckIn =
                bk.status === "accepted" && bk.check_in_status !== "checked_in";
              const inProg = bk.status === "in_progress";
              return (
                <Animated.View
                  key={bk._id}
                  entering={FadeInUp.delay(600).duration(400)}
                  className="mx-5 mb-3"
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
                    className={`rounded-2xl p-4 ${needsCheckIn ? "bg-accent/10 border border-accent/20" : inProg ? "bg-blue-50 border border-blue-100" : "bg-green-50 border border-green-100"}`}
                  >
                    <View className="flex-row items-center">
                      <View
                        className={`w-10 h-10 rounded-full items-center justify-center ${needsCheckIn ? "bg-accent/20" : inProg ? "bg-blue-100" : "bg-green-100"}`}
                      >
                        <Ionicons
                          name={
                            inProg
                              ? "navigate"
                              : needsCheckIn
                                ? "key"
                                : "checkmark-circle"
                          }
                          size={20}
                          color={
                            needsCheckIn
                              ? "#D4A017"
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

            {/* Status */}
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
        </ScrollView>
      </Animated.View>

      <LanguageOnboarding />

      {/* ── Rating Modal ───────────────────────────────────────────── */}
      <Modal
        visible={showRating}
        transparent
        animationType="fade"
        onRequestClose={skipRating}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <Animated.View
            entering={FadeInUp.duration(400)}
            className="bg-white rounded-3xl w-full p-6"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 20,
            }}
          >
            <Pressable
              onPress={skipRating}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 items-center justify-center z-10"
            >
              <Ionicons name="close" size={18} color="#6B7280" />
            </Pressable>
            <View className="items-center mb-5">
              <View className="w-16 h-16 rounded-full bg-accent/10 items-center justify-center mb-3">
                <Ionicons name="star" size={30} color="#D4A017" />
              </View>
              <Text className="text-xl font-bold text-gray-900">
                <T>Rate Your Ride</T>
              </Text>
              <Text className="text-sm text-gray-500 mt-1">
                <T>How was your experience?</T>
              </Text>
            </View>
            <View className="flex-row justify-center mb-5">
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
            <TextInput
              value={ratingText}
              onChangeText={setRatingText}
              placeholder="Feedback (optional)"
              placeholderTextColor="#9CA3AF"
              multiline
              className="bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-800 mb-5"
              style={{ minHeight: 70, textAlignVertical: "top" }}
            />
            <TouchableOpacity
              onPress={submitRating}
              disabled={ratingVal === 0}
              className={`rounded-2xl py-4 items-center ${ratingVal > 0 ? "bg-primary" : "bg-gray-200"}`}
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
