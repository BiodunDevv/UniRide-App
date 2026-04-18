import React, { useEffect, useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  BackHandler,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";

import { useRideStore, Ride } from "@/store/useRideStore";
import { usePlatformSettingsStore } from "@/store/usePlatformSettingsStore";
import { useAuthStore } from "@/store/useAuthStore";
import { T } from "@/hooks/use-translation";
import { locationApi } from "@/lib/rideApi";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#7C3AED",
  available: "#16A34A",
  accepted: "#2563EB",
  in_progress: "#D97706",
};

export default function AvailableRidesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    availableRides,
    isLoadingRides,
    fetchActiveRides,
    selectedPickup,
    selectedDestination,
  } = useRideStore();
  const { settings } = usePlatformSettingsStore();
  const hasBookingPhone = Boolean(user?.phone?.trim());

  const [refreshing, setRefreshing] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [checkingOnlineDrivers, setCheckingOnlineDrivers] = useState(false);
  const [onlineDriversCount, setOnlineDriversCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "scheduled" | "available">(
    "all",
  );

  const routeFilterReady = Boolean(selectedPickup && selectedDestination);
  const hasOnlineDrivers = onlineDriversCount > 0;

  const canCreateOwnRide = Boolean(
    settings.allow_ride_without_driver && routeFilterReady && hasOnlineDrivers,
  );

  // Fetch with optional route filter
  const doFetch = useCallback(async () => {
    setCheckingOnlineDrivers(true);
    try {
      await fetchActiveRides(
        routeFilterReady
          ? {
              pickup: selectedPickup?._id,
              destination: selectedDestination?._id,
            }
          : undefined,
      );
      try {
        const res = await locationApi.getOnlineDrivers();
        setOnlineDriversCount(Array.isArray(res?.data) ? res.data.length : 0);
      } catch {
        setOnlineDriversCount(0);
      }
    } finally {
      setCheckingOnlineDrivers(false);
      setInitialLoadDone(true);
    }
  }, [
    fetchActiveRides,
    routeFilterReady,
    selectedDestination?._id,
    selectedPickup?._id,
  ]);

  useEffect(() => {
    setInitialLoadDone(false);
    void doFetch();
  }, [doFetch]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      router.back();
      return true;
    });
    return () => sub.remove();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await doFetch();
    setRefreshing(false);
  }, [doFetch]);

  const rides = useMemo(() => {
    let list = availableRides;
    if (filter === "scheduled")
      list = list.filter((r) => r.status === "scheduled");
    else if (filter === "available")
      list = list.filter((r) => r.status === "available");
    return list;
  }, [availableRides, filter]);

  const bestMatchRide = useMemo(() => {
    if (!rides.length) return null;

    const statusRank = (status: Ride["status"]) => {
      if (status === "available") return 0;
      if (status === "scheduled") return 1;
      if (status === "accepted") return 2;
      return 3;
    };

    return [...rides].sort((a, b) => {
      const byStatus = statusRank(a.status) - statusRank(b.status);
      if (byStatus !== 0) return byStatus;

      const aTime = a.departure_time ? new Date(a.departure_time).getTime() : 0;
      const bTime = b.departure_time ? new Date(b.departure_time).getTime() : 0;
      return aTime - bTime;
    })[0];
  }, [rides]);

  const handleCreateOwnRide = useCallback(() => {
    if (hasBookingPhone) {
      router.push("/(users)/request-ride" as any);
      return;
    }

    router.push("/settings/edit-profile" as any);
  }, [hasBookingPhone, router]);

  const handleOpenBestMatch = useCallback(() => {
    if (!bestMatchRide) return;

    router.push({
      pathname: "/(users)/ride-details" as any,
      params: { rideId: bestMatchRide._id },
    });
  }, [bestMatchRide, router]);

  const routeLabel = useMemo(() => {
    if (!routeFilterReady) return null;

    const parts = [];
    if (selectedPickup)
      parts.push(selectedPickup.short_name || selectedPickup.name);
    if (selectedDestination)
      parts.push(selectedDestination.short_name || selectedDestination.name);
    return parts.join(" → ") || null;
  }, [routeFilterReady, selectedPickup, selectedDestination]);

  const showLoadingState =
    !initialLoadDone || (isLoadingRides && rides.length === 0);

  // ═════════════════════════════════════════════════════════════════════
  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={["top"]} className="flex-1">
        {/* ── Header ─────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInUp.duration(300)}
          className="px-5 pt-3 pb-2"
        >
          <View className="flex-row items-center mb-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3"
            >
              <Ionicons name="arrow-back" size={20} color="#042F40" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-xl font-bold text-gray-900">
                <T>Available Rides</T>
              </Text>
              {routeLabel && (
                <Text className="text-xs text-gray-400 mt-0.5">
                  {routeLabel}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(users)/search-ride" as any)}
              className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
            >
              <Ionicons name="search" size={18} color="#042F40" />
            </TouchableOpacity>
          </View>

          {/* ── Filter Chips ────────────────────────────────────── */}
          <View className="flex-row gap-2 mb-1">
            {(["all", "available", "scheduled"] as const).map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                className={`px-4 py-2 rounded-full ${filter === f ? "bg-primary" : "bg-gray-100"}`}
              >
                <Text
                  className={`text-xs font-semibold ${filter === f ? "text-white" : "text-gray-600"}`}
                >
                  {f === "all"
                    ? "All"
                    : f === "available"
                      ? "Available"
                      : "Scheduled"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="mt-2 self-start flex-row items-center rounded-full bg-slate-100 px-3 py-1.5">
            {checkingOnlineDrivers ? (
              <ActivityIndicator size="small" color="#64748B" />
            ) : (
              <Ionicons
                name={
                  hasOnlineDrivers ? "radio-outline" : "cloud-offline-outline"
                }
                size={13}
                color={hasOnlineDrivers ? "#059669" : "#EF4444"}
              />
            )}
            <Text
              className={`ml-1.5 text-[11px] font-semibold ${hasOnlineDrivers ? "text-emerald-700" : "text-rose-600"}`}
            >
              {checkingOnlineDrivers ? (
                <T>Checking driver availability...</T>
              ) : hasOnlineDrivers ? (
                <>
                  {onlineDriversCount} <T>driver</T>
                  {onlineDriversCount === 1 ? " " : "s "}
                  <T>online</T>
                </>
              ) : (
                <T>No drivers online right now</T>
              )}
            </Text>
          </View>
        </Animated.View>

        {settings.allow_ride_without_driver &&
        routeFilterReady &&
        rides.length > 0 ? (
          <Animated.View
            entering={FadeInUp.delay(80).duration(280)}
            className="mx-5 mt-1 mb-2 rounded-[22px] border border-slate-200 bg-white px-4 py-4"
          >
            <Text className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              <T>Smart choice</T>
            </Text>
            <Text className="mt-1 text-base font-semibold text-[#042F40]">
              {canCreateOwnRide ? (
                <T>Join an existing ride or create your own</T>
              ) : (
                <T>Join an existing ride while drivers come online</T>
              )}
            </Text>
            <Text className="mt-1 text-xs leading-5 text-slate-500">
              {rides.length} <T>ride</T>
              {rides.length === 1 ? " " : "s "}
              <T>already match this route.</T>
            </Text>

            <View className="mt-3 flex-row gap-2.5">
              <TouchableOpacity
                onPress={handleOpenBestMatch}
                className="flex-1 rounded-xl bg-[#042F40] px-3.5 py-3"
                activeOpacity={0.88}
              >
                <View className="flex-row items-center justify-center">
                  <Ionicons name="car-outline" size={15} color="#FFFFFF" />
                  <Text className="ml-1.5 text-xs font-semibold text-white">
                    <T>Join best match</T>
                  </Text>
                </View>
              </TouchableOpacity>

              {canCreateOwnRide ? (
                <TouchableOpacity
                  onPress={handleCreateOwnRide}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3"
                  activeOpacity={0.88}
                >
                  <View className="flex-row items-center justify-center">
                    <Ionicons
                      name="add-circle-outline"
                      size={15}
                      color="#042F40"
                    />
                    <Text className="ml-1.5 text-xs font-semibold text-[#042F40]">
                      {hasBookingPhone ? (
                        <T>Create my request</T>
                      ) : (
                        <T>Add phone first</T>
                      )}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View className="flex-1 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3">
                  <View className="flex-row items-center justify-center">
                    <Ionicons name="time-outline" size={15} color="#DC2626" />
                    <Text className="ml-1.5 text-xs font-semibold text-rose-600">
                      <T>Create request unavailable</T>
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </Animated.View>
        ) : null}

        {/* ── Ride List ──────────────────────────────────────────── */}
        {showLoadingState ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#042F40" />
          </View>
        ) : (
          <FlatList
            data={rides}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 40,
              paddingTop: 8,
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#042F40"
              />
            }
            ListEmptyComponent={
              <View className="items-center mt-16">
                <Ionicons name="car-outline" size={48} color="#D1D5DB" />
                <Text className="text-base text-gray-400 mt-4 text-center">
                  <T>No rides available right now</T>
                </Text>
                <Text className="text-sm text-gray-300 mt-1 text-center">
                  <T>Pull down to refresh</T>
                </Text>
                {settings.allow_ride_without_driver ? (
                  routeFilterReady ? (
                    checkingOnlineDrivers ? (
                      <View className="mt-6 flex-row items-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3">
                        <ActivityIndicator size="small" color="#64748B" />
                        <Text className="ml-2 text-xs font-semibold text-slate-600">
                          <T>Checking if drivers are online...</T>
                        </Text>
                      </View>
                    ) : hasOnlineDrivers ? (
                      <TouchableOpacity
                        onPress={() =>
                          hasBookingPhone
                            ? router.push("/(users)/request-ride" as any)
                            : router.push("/settings/edit-profile" as any)
                        }
                        className="mt-6 bg-accent rounded-2xl px-6 py-3.5 flex-row items-center mb-3"
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="hand-right-outline"
                          size={18}
                          color="#fff"
                        />
                        <Text className="text-white font-bold text-sm ml-2">
                          {hasBookingPhone ? (
                            <T>Request a Ride</T>
                          ) : (
                            <T>Add Phone to Request</T>
                          )}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View className="mt-6 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4">
                        <Text className="text-center text-sm font-semibold text-rose-700">
                          <T>No drivers are online right now</T>
                        </Text>
                        <Text className="mt-1 text-center text-xs text-rose-600">
                          <T>
                            You can join existing rides when available, but new
                            ride requests are paused until a driver comes
                            online.
                          </T>
                        </Text>
                      </View>
                    )
                  ) : (
                    <TouchableOpacity
                      onPress={() => router.push("/(users)/search-ride" as any)}
                      className="mt-6 rounded-2xl border border-[#042F40] bg-[#042F40] px-6 py-3.5 flex-row items-center mb-3"
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name="navigate-outline"
                        size={18}
                        color="#fff"
                      />
                      <Text className="text-white font-bold text-sm ml-2">
                        <T>Select Route to Request Ride</T>
                      </Text>
                    </TouchableOpacity>
                  )
                ) : null}
              </View>
            }
            renderItem={({ item, index }) => (
              <RideCard
                ride={item}
                index={index}
                farePerSeat={settings.fare_per_seat}
                onPress={() =>
                  router.push({
                    pathname: "/(users)/ride-details" as any,
                    params: { rideId: item._id },
                  })
                }
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

// ── Ride Card ────────────────────────────────────────────────────────
function RideCard({
  ride,
  index,
  farePerSeat,
  onPress,
}: {
  ride: Ride;
  index: number;
  farePerSeat: boolean;
  onPress: () => void;
}) {
  const pickup =
    typeof ride.pickup_location_id === "object"
      ? ride.pickup_location_id
      : null;
  const dest =
    typeof ride.destination_id === "object" ? ride.destination_id : null;
  const driver =
    ride.driver_id && typeof ride.driver_id === "object"
      ? ride.driver_id
      : null;
  const seatsLeft =
    ride.seats_remaining ?? ride.available_seats - ride.booked_seats;
  const statusColor = STATUS_COLORS[ride.status] || "#6B7280";
  const dep = ride.departure_time ? new Date(ride.departure_time) : null;
  const timeStr = dep
    ? dep.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  const dateStr = dep
    ? dep.toLocaleDateString([], { month: "short", day: "numeric" })
    : null;
  const dist = ride.distance_meters
    ? `${(ride.distance_meters / 1000).toFixed(1)} km`
    : null;
  const dur = ride.duration_seconds
    ? `${Math.round(ride.duration_seconds / 60)} min`
    : null;

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
      <TouchableOpacity
        onPress={onPress}
        className="bg-white rounded-2xl p-4 mb-3 border border-gray-100"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        }}
        activeOpacity={0.7}
      >
        {/* Status + Time */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <View
              className="w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: statusColor }}
            />
            <Text
              className="text-xs font-semibold capitalize"
              style={{ color: statusColor }}
            >
              {ride.status.replace("_", " ")}
            </Text>
          </View>
          {timeStr && (
            <View className="flex-row items-center">
              <Ionicons name="time-outline" size={12} color="#9CA3AF" />
              <Text className="text-xs text-gray-500 ml-1">
                {dateStr} · {timeStr}
              </Text>
            </View>
          )}
        </View>

        {/* Route */}
        <View className="flex-row items-start mb-3">
          <View className="items-center mr-3 mt-1">
            <View className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <View className="w-0.5 h-8 bg-gray-200 my-1" />
            <View className="w-2.5 h-2.5 rounded-full bg-red-500" />
          </View>
          <View className="flex-1">
            <Text
              className="text-sm font-semibold text-gray-800"
              numberOfLines={1}
            >
              {pickup?.short_name ||
                pickup?.name ||
                ride.pickup_location?.address ||
                "Pickup"}
            </Text>
            <View className="h-5" />
            <Text
              className="text-sm font-semibold text-gray-800"
              numberOfLines={1}
            >
              {dest?.short_name ||
                dest?.name ||
                ride.destination?.address ||
                "Destination"}
            </Text>
          </View>
        </View>

        {/* Bottom row */}
        <View className="flex-row items-center justify-between pt-3 border-t border-gray-50">
          <View className="flex-row items-center gap-3">
            {(driver?.user_id?.name || driver?.name) && (
              <View className="flex-row items-center">
                <Ionicons
                  name="person-circle-outline"
                  size={14}
                  color="#6B7280"
                />
                <Text className="text-xs text-gray-500 ml-1">
                  {(typeof driver.user_id === "object"
                    ? driver.user_id.name
                    : driver.name
                  )?.split(" ")[0] || "Driver"}
                </Text>
              </View>
            )}
            <View className="flex-row items-center">
              <Ionicons name="people-outline" size={14} color="#6B7280" />
              <Text className="text-xs text-gray-500 ml-1">
                {seatsLeft} <T>left</T>
              </Text>
            </View>
            {dist && (
              <View className="flex-row items-center">
                <Ionicons name="navigate-outline" size={12} color="#6B7280" />
                <Text className="text-xs text-gray-500 ml-1">{dist}</Text>
              </View>
            )}
            {dur && (
              <View className="flex-row items-center">
                <Ionicons name="timer-outline" size={12} color="#6B7280" />
                <Text className="text-xs text-gray-500 ml-1">{dur}</Text>
              </View>
            )}
          </View>
          <Text className="text-base font-bold text-primary">
            ₦{ride.fare}
            {farePerSeat ? (
              <Text className="text-xs font-normal text-gray-400">/seat</Text>
            ) : null}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
