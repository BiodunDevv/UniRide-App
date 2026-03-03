import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  BackHandler,
  ActivityIndicator,
  Share,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";

import { useRideStore, Ride, Booking } from "@/store/useRideStore";
import { useLocationStore } from "@/store/useLocationStore";
import { usePlatformSettingsStore } from "@/store/usePlatformSettingsStore";
import { useSocket } from "@/hooks/use-socket";
import { eventBus } from "@/lib/eventBus";
import { T } from "@/hooks/use-translation";

const STATUS_BADGES: Record<
  string,
  { bg: string; text: string; color: string }
> = {
  scheduled: {
    bg: "bg-purple-50",
    text: "Scheduled",
    color: "text-purple-600",
  },
  available: { bg: "bg-green-50", text: "Available", color: "text-green-600" },
  accepted: { bg: "bg-blue-50", text: "Accepted", color: "text-blue-600" },
  in_progress: {
    bg: "bg-amber-50",
    text: "In Progress",
    color: "text-amber-600",
  },
  completed: { bg: "bg-gray-50", text: "Completed", color: "text-gray-500" },
  cancelled: { bg: "bg-red-50", text: "Cancelled", color: "text-red-500" },
  pending: { bg: "bg-yellow-50", text: "Pending", color: "text-yellow-600" },
  declined: { bg: "bg-red-50", text: "Declined", color: "text-red-500" },
};

export default function DriverRideDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    rideId?: string;
    bookingId?: string;
  }>();
  const { settings } = usePlatformSettingsStore();
  const { isDriverOnline } = useLocationStore();
  const {
    fetchRideDetails,
    driverBookings,
    fetchDriverBookings,
    acceptBooking,
    declineBooking,
    acceptRideRequest,
    isLoadingDriverBookings,
  } = useRideStore();

  const { joinRide, leaveRide } = useSocket();
  const rideIdRef = useRef<string | null>(null);

  const [ride, setRide] = useState<Ride | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refreshData = useCallback(async () => {
    const rid = rideIdRef.current;
    if (!rid) return;
    try {
      const r = await fetchRideDetails(rid);
      setRide(r);
    } catch {}
    await fetchDriverBookings();
    const allBk = useRideStore.getState().driverBookings;
    setBookings(
      allBk.filter((b) => {
        const bRide = typeof b.ride_id === "object" ? b.ride_id._id : b.ride_id;
        return bRide === rid;
      }),
    );
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData]),
  );

  // ── Load ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let rideId = params.rideId;
        if (params.bookingId) {
          await fetchDriverBookings();
          const bk = useRideStore
            .getState()
            .driverBookings.find((b) => b._id === params.bookingId);
          if (bk)
            rideId =
              typeof bk.ride_id === "object" ? bk.ride_id._id : bk.ride_id;
        }
        if (rideId) {
          rideIdRef.current = rideId;
          joinRide(rideId);
          const r = await fetchRideDetails(rideId);
          setRide(r);
          await fetchDriverBookings();
          const allBk = useRideStore.getState().driverBookings;
          setBookings(
            allBk.filter((b) => {
              const bRide =
                typeof b.ride_id === "object" ? b.ride_id._id : b.ride_id;
              return bRide === rideId;
            }),
          );
        }
      } catch (e: any) {
        Alert.alert("Error", e?.message || "Failed to load");
      }
      setLoading(false);
    })();
  }, [params.rideId, params.bookingId]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      router.back();
      return true;
    });
    return () => sub.remove();
  }, []);

  // ── Socket: real-time updates ─────────────────────────────────────
  useEffect(() => {
    return () => {
      if (rideIdRef.current) leaveRide(rideIdRef.current);
    };
  }, []);
  useEffect(() => {
    const refresh = async () => {
      const rid = rideIdRef.current;
      if (rid) {
        try {
          const r = await fetchRideDetails(rid);
          setRide(r);
        } catch {}
      }
      await fetchDriverBookings();
      const allBk = useRideStore.getState().driverBookings;
      if (rid)
        setBookings(
          allBk.filter((b) => {
            const bRide =
              typeof b.ride_id === "object" ? b.ride_id._id : b.ride_id;
            return bRide === rid;
          }),
        );
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

  // ── Derived ───────────────────────────────────────────────────────
  const pickup =
    ride && typeof ride.pickup_location_id === "object"
      ? ride.pickup_location_id
      : null;
  const dest =
    ride && typeof ride.destination_id === "object"
      ? ride.destination_id
      : null;
  const driver =
    ride?.driver_id && typeof ride.driver_id === "object"
      ? ride.driver_id
      : null;
  const seatsLeft = ride
    ? (ride.seats_remaining ?? ride.available_seats - ride.booked_seats)
    : 0;
  const dep = ride?.departure_time ? new Date(ride.departure_time) : null;
  const dist = ride?.distance_meters
    ? `${(ride.distance_meters / 1000).toFixed(1)} km`
    : null;
  const dur = ride?.duration_seconds
    ? `${Math.round(ride.duration_seconds / 60)} min`
    : null;
  const isRequestRide = ride && !ride.driver_id;

  // ── Actions ───────────────────────────────────────────────────────
  const requireOnline = (action: () => void) => {
    if (!isDriverOnline) {
      Alert.alert(
        "Go Online First",
        "You must be online to perform this action.",
      );
      return;
    }
    action();
  };

  const handleAcceptBooking = async (bookingId: string) => {
    requireOnline(async () => {
      setActionId(bookingId);
      try {
        await acceptBooking(bookingId);
        setBookings((prev) =>
          prev.map((b) =>
            b._id === bookingId ? { ...b, status: "accepted" } : b,
          ),
        );
        Alert.alert("Accepted", "Booking confirmed.");
      } catch (e: any) {
        Alert.alert("Error", e?.message || "Failed");
      }
      setActionId(null);
    });
  };

  const handleDeclineBooking = (bookingId: string) => {
    requireOnline(() => {
      Alert.alert("Decline?", "This will decline the passenger's booking.", [
        { text: "No", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            setActionId(bookingId);
            try {
              await declineBooking(bookingId);
              setBookings((prev) =>
                prev.map((b) =>
                  b._id === bookingId ? { ...b, status: "declined" } : b,
                ),
              );
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Failed");
            }
            setActionId(null);
          },
        },
      ]);
    });
  };

  const handleAcceptRequest = async () => {
    if (!ride) return;
    requireOnline(() => {
      Alert.alert(
        "Accept Ride?",
        "You'll be assigned as the driver for this ride.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Accept",
            onPress: async () => {
              try {
                await acceptRideRequest(ride._id);
                Alert.alert("Accepted!", "You are now the driver.", [
                  { text: "OK", onPress: () => router.back() },
                ]);
              } catch (e: any) {
                Alert.alert("Error", e?.message || "Failed");
              }
            },
          },
        ],
      );
    });
  };

  const handleShare = async () => {
    if (!ride?.check_in_code) return;
    try {
      await Share.share({
        message: `UniRide Check-in Code: ${ride.check_in_code}\n${pickup?.name || "Pickup"} → ${dest?.name || "Destination"}`,
      });
    } catch {}
  };

  const handleStartRide = () => {
    if (ride) {
      requireOnline(() => {
        router.push({
          pathname: "/(drivers)/active-ride" as any,
          params: { rideId: ride._id },
        });
      });
    }
  };

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#042F40" />
      </View>
    );
  if (!ride)
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-400">
          <T>Ride not found</T>
        </Text>
      </View>
    );

  const badge = STATUS_BADGES[ride.status] || STATUS_BADGES.available;

  // ═════════════════════════════════════════════════════════════════════
  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={["top"]} className="flex-1">
        {/* Header */}
        <Animated.View
          entering={FadeInUp.duration(300)}
          className="px-5 pt-3 pb-2 flex-row items-center"
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3"
          >
            <Ionicons name="arrow-back" size={20} color="#042F40" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900 flex-1">
            <T>Ride Details</T>
          </Text>
          <View className={`px-3 py-1 rounded-full ${badge.bg}`}>
            <Text className={`text-xs font-semibold ${badge.color}`}>
              <T>{badge.text}</T>
            </Text>
          </View>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#042F40"
            />
          }
        >
          {/* Route */}
          <Animated.View
            entering={FadeInUp.delay(100).duration(300)}
            className="mx-5 mt-3 bg-gray-50 rounded-2xl p-4"
          >
            <View className="flex-row items-start">
              <View className="items-center mr-3 mt-1">
                <View className="w-3 h-3 rounded-full bg-green-500" />
                <View className="w-0.5 h-10 bg-gray-300 my-1" />
                <View className="w-3 h-3 rounded-full bg-red-500" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-800">
                  {pickup?.short_name || pickup?.name || "Pickup"}
                </Text>
                <Text className="text-xs text-gray-400 mb-5">
                  {pickup?.address || ""}
                </Text>
                <Text className="text-sm font-semibold text-gray-800">
                  {dest?.short_name || dest?.name || "Destination"}
                </Text>
                <Text className="text-xs text-gray-400">
                  {dest?.address || ""}
                </Text>
              </View>
            </View>
            <View className="flex-row mt-4 pt-3 border-t border-gray-200 gap-3">
              {dep && (
                <View className="flex-1 items-center">
                  <Ionicons name="time-outline" size={14} color="#6B7280" />
                  <Text className="text-xs font-semibold text-gray-700 mt-1">
                    {dep.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              )}
              {dist && (
                <View className="flex-1 items-center">
                  <Ionicons name="navigate-outline" size={14} color="#6B7280" />
                  <Text className="text-xs font-semibold text-gray-700 mt-1">
                    {dist}
                  </Text>
                </View>
              )}
              {dur && (
                <View className="flex-1 items-center">
                  <Ionicons name="timer-outline" size={14} color="#6B7280" />
                  <Text className="text-xs font-semibold text-gray-700 mt-1">
                    {dur}
                  </Text>
                </View>
              )}
              <View className="flex-1 items-center">
                <Ionicons name="people-outline" size={14} color="#6B7280" />
                <Text className="text-xs font-semibold text-gray-700 mt-1">
                  {seatsLeft}/{ride.available_seats}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Fare */}
          <Animated.View
            entering={FadeInUp.delay(150).duration(300)}
            className="mx-5 mt-3 bg-primary/5 rounded-2xl p-4 flex-row items-center justify-between"
          >
            <Text className="text-sm text-gray-600">
              <T>Fare</T>
            </Text>
            <Text className="text-2xl font-bold text-primary">
              ₦{ride.fare}
              {settings.fare_per_seat ? (
                <Text className="text-xs font-normal text-gray-400">/seat</Text>
              ) : null}
            </Text>
          </Animated.View>

          {/* Check-in Code */}
          {ride.check_in_code && (
            <Animated.View
              entering={FadeInUp.delay(200).duration(300)}
              className="mx-5 mt-3"
            >
              <TouchableOpacity
                onPress={handleShare}
                className="bg-accent/10 rounded-2xl p-4 flex-row items-center border border-accent/20"
              >
                <View className="w-12 h-12 rounded-full bg-accent/20 items-center justify-center mr-3">
                  <Ionicons name="key" size={24} color="#D4A017" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-gray-400 mb-1">
                    <T>Check-in Code</T>
                  </Text>
                  <Text className="text-2xl font-bold text-accent tracking-[8px]">
                    {ride.check_in_code}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleShare}
                  className="bg-accent/20 rounded-full w-10 h-10 items-center justify-center"
                >
                  <Ionicons name="share-outline" size={18} color="#D4A017" />
                </TouchableOpacity>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Bookings */}
          <Animated.View
            entering={FadeInUp.delay(250).duration(300)}
            className="mx-5 mt-4"
          >
            <Text className="text-xs font-semibold text-gray-400 uppercase mb-3 tracking-wider">
              <T>Bookings</T> ({bookings.length})
            </Text>
            {bookings.length === 0 ? (
              <View className="bg-gray-50 rounded-xl p-4 items-center">
                <Ionicons name="people-outline" size={28} color="#D1D5DB" />
                <Text className="text-sm text-gray-400 mt-2">
                  <T>No bookings yet</T>
                </Text>
              </View>
            ) : (
              bookings.map((bk, idx) => {
                const usr =
                  bk.user_id && typeof bk.user_id === "object"
                    ? bk.user_id
                    : null;
                const bBadge =
                  STATUS_BADGES[bk.status] || STATUS_BADGES.pending;
                const isPending = bk.status === "pending";
                return (
                  <Animated.View
                    key={bk._id}
                    entering={FadeInDown.delay(idx * 50).duration(250)}
                  >
                    <View className="bg-white rounded-xl p-3 mb-2 border border-gray-100">
                      <View className="flex-row items-center">
                        {usr?.profile_picture ? (
                          <Image
                            source={{ uri: usr.profile_picture }}
                            className="w-10 h-10 rounded-full mr-3"
                          />
                        ) : (
                          <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3">
                            <Ionicons name="person" size={18} color="#042F40" />
                          </View>
                        )}
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-gray-800">
                            {usr?.name || "Passenger"}
                          </Text>
                          <Text className="text-xs text-gray-400">
                            {bk.seats_requested} seat
                            {bk.seats_requested > 1 ? "s" : ""} ·{" "}
                            {bk.payment_method} ·{" "}
                            <Text className={bBadge.color}>{bk.status}</Text>
                          </Text>
                        </View>
                        {bk.check_in_status === "checked_in" && (
                          <View className="bg-green-100 rounded-full px-2 py-0.5">
                            <Text className="text-[10px] text-green-700 font-semibold">
                              ✓ In
                            </Text>
                          </View>
                        )}
                      </View>
                      {isPending && !settings.auto_accept_bookings && (
                        <View className="flex-row mt-3 gap-2">
                          <TouchableOpacity
                            onPress={() => handleAcceptBooking(bk._id)}
                            disabled={actionId === bk._id}
                            className="flex-1 bg-green-500 rounded-xl py-2.5 items-center"
                          >
                            {actionId === bk._id ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text className="text-white font-bold text-sm">
                                <T>Accept</T>
                              </Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeclineBooking(bk._id)}
                            disabled={actionId === bk._id}
                            className="flex-1 bg-red-50 rounded-xl py-2.5 items-center border border-red-100"
                          >
                            <Text className="text-red-500 font-bold text-sm">
                              <T>Decline</T>
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </Animated.View>
                );
              })
            )}
          </Animated.View>
        </ScrollView>

        {/* Bottom Action  */}
        <SafeAreaView
          edges={["bottom"]}
          className="px-5 pt-3 border-t border-gray-100 bg-white"
        >
          {isRequestRide ? (
            <TouchableOpacity
              onPress={handleAcceptRequest}
              className="bg-purple-600 rounded-2xl py-4 items-center mb-2"
            >
              <Text className="text-white font-bold text-base">
                <T>Accept Ride Request</T>
              </Text>
            </TouchableOpacity>
          ) : ride.status === "accepted" ||
            ride.status === "available" ||
            ride.status === "scheduled" ? (
            <TouchableOpacity
              onPress={handleStartRide}
              className="bg-primary rounded-2xl py-4 items-center mb-2"
            >
              <Text className="text-white font-bold text-base">
                <T>Start Ride</T>
              </Text>
            </TouchableOpacity>
          ) : null}
        </SafeAreaView>
      </SafeAreaView>
    </View>
  );
}
