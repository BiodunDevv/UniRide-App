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
  Linking,
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

function formatDeparture(value?: string) {
  if (!value) return "Flexible departure";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Flexible departure";
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

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
    updatePaymentStatus,
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
  const requesterName = ride?.created_by?.name || "Passenger";
  const requestedSeats = ride?.booked_seats || ride?.available_seats || 1;
  const seatsLeft = ride
    ? (ride.seats_remaining ?? ride.available_seats - ride.booked_seats)
    : 0;
  const departureLabel = formatDeparture(ride?.departure_time);
  const dist = ride?.distance_meters
    ? `${(ride.distance_meters / 1000).toFixed(1)} km`
    : null;
  const dur = ride?.duration_seconds
    ? `${Math.round(ride.duration_seconds / 60)} min`
    : null;
  const isRequestRide = ride && !ride.driver_id;

  // ── Check-in status ───────────────────────────────────────────
  const acceptedBookings = bookings.filter(
    (b) => b.status === "accepted" || b.status === "in_progress",
  );
  const checkedInCount = bookings.filter(
    (b) => b.check_in_status === "checked_in",
  ).length;
  const totalPassengers = acceptedBookings.length;
  const hasCheckedIn = checkedInCount > 0;
  const allCheckedIn =
    totalPassengers > 0 && checkedInCount === totalPassengers;
  const canStartRide =
    hasCheckedIn &&
    (ride?.status === "accepted" ||
      ride?.status === "available" ||
      ride?.status === "scheduled" ||
      ride?.status === "in_progress");

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
                await refreshData();
                Alert.alert(
                  "Accepted!",
                  "You are now the driver for this ride. It will also appear on your home screen and rides list.",
                );
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

  const handleConfirmPayment = (bookingId: string, passengerName: string) => {
    Alert.alert(
      "Confirm Payment",
      `Did you receive the transfer payment from ${passengerName}?`,
      [
        { text: "Not Yet", style: "cancel" },
        {
          text: "Yes, Received",
          onPress: async () => {
            setActionId(bookingId);
            try {
              await updatePaymentStatus(bookingId, "paid");
              setBookings((prev) =>
                prev.map((b) =>
                  b._id === bookingId
                    ? { ...b, payment_status: "paid" as const }
                    : b,
                ),
              );
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Failed to update");
            }
            setActionId(null);
          },
        },
      ],
    );
  };

  const handleCallPassenger = async (phone?: string | null) => {
    if (!phone) {
      Alert.alert(
        "Phone unavailable",
        "This passenger has not added a phone number yet.",
      );
      return;
    }
    const telUrl = `tel:${phone}`;
    const supported = await Linking.canOpenURL(telUrl);
    if (!supported) {
      Alert.alert(
        "Call unavailable",
        "This device cannot open the phone dialer.",
      );
      return;
    }
    Linking.openURL(telUrl);
  };

  const handleStartRide = () => {
    if (!ride) return;
    if (!hasCheckedIn) {
      Alert.alert(
        "Waiting for Check-in",
        "At least one passenger must check in before you can start the ride. Share your check-in code with passengers.",
      );
      return;
    }
    requireOnline(() => {
      router.push({
        pathname: "/(drivers)/active-ride" as any,
        params: { rideId: ride._id },
      });
    });
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
    <View className="flex-1 bg-slate-50">
      <SafeAreaView edges={["top", "bottom"]} className="flex-1">
        {/* Header */}
        <Animated.View
          entering={FadeInUp.duration(300)}
          className="px-5 pt-3 pb-2"
        >
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-3 h-11 w-11 rounded-2xl bg-white items-center justify-center"
            >
              <Ionicons name="arrow-back" size={20} color="#042F40" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Driver Operations
              </Text>
              <Text className="mt-1 text-xl font-bold text-gray-900">
                <T>Ride Details</T>
              </Text>
            </View>
            <View className={`px-3 py-1 rounded-full ${badge.bg}`}>
              <Text className={`text-xs font-semibold ${badge.color}`}>
                <T>{badge.text}</T>
              </Text>
            </View>
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
          {/* Route Overview */}
          <Animated.View
            entering={FadeInUp.delay(100).duration(300)}
            className="mx-5 mt-3"
          >
            <View
              className="rounded-[26px] border border-slate-200 bg-white p-4"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 5,
              }}
            >
              <View className="mb-3 flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                    <Ionicons
                      name="navigate-outline"
                      size={18}
                      color="#042F40"
                    />
                  </View>
                  <View className="max-w-[72%]">
                    <Text className="text-sm font-semibold text-slate-900">
                      {pickup?.short_name || pickup?.name || "Pickup"} {"→"}{" "}
                      {dest?.short_name || dest?.name || "Destination"}
                    </Text>
                    <Text className="mt-1 text-xs text-slate-500">
                      {[dist, dur].filter(Boolean).join(" · ") ||
                        "Campus route"}
                    </Text>
                  </View>
                </View>
                <View className={`rounded-full px-3 py-1.5 ${badge.bg}`}>
                  <Text className={`text-xs font-semibold ${badge.color}`}>
                    <T>{badge.text}</T>
                  </Text>
                </View>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1 rounded-2xl bg-slate-50 px-3 py-3">
                  <Text className="text-[11px] text-slate-500">
                    <T>Fare</T>
                  </Text>
                  <Text className="mt-1 text-base font-bold text-slate-900">
                    ₦{Number(ride.fare || 0).toLocaleString()}
                  </Text>
                </View>
                <View className="flex-1 rounded-2xl bg-slate-50 px-3 py-3">
                  <Text className="text-[11px] text-slate-500">
                    <T>Seats</T>
                  </Text>
                  <Text className="mt-1 text-base font-bold text-slate-900">
                    {seatsLeft}/{ride.available_seats}
                  </Text>
                </View>
                <View className="flex-1 rounded-2xl bg-slate-50 px-3 py-3">
                  <Text className="text-[11px] text-slate-500">
                    <T>Departure</T>
                  </Text>
                  <Text className="mt-1 text-base font-bold text-slate-900">
                    {departureLabel}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(130).duration(300)}
            className="mx-5 mt-3 rounded-[26px] bg-[#042F40] px-4 py-4"
          >
            <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D4A017]">
              Ride Summary
            </Text>
            <Text className="mt-2 text-lg font-bold text-white">
              {pickup?.short_name || pickup?.name || "Pickup"} {"→"}{" "}
              {dest?.short_name || dest?.name || "Destination"}
            </Text>
            <View className="mt-4 flex-row gap-3">
              <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                <Text className="text-[11px] text-slate-300">
                  <T>Bookings</T>
                </Text>
                <Text className="mt-1 text-xl font-bold text-white">
                  {bookings.length}
                </Text>
              </View>
              <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                <Text className="text-[11px] text-slate-300">
                  <T>Checked in</T>
                </Text>
                <Text className="mt-1 text-xl font-bold text-white">
                  {checkedInCount}
                </Text>
              </View>
              <View className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
                <Text className="text-[11px] text-slate-300">
                  <T>Seats left</T>
                </Text>
                <Text className="mt-1 text-xl font-bold text-white">
                  {seatsLeft}
                </Text>
              </View>
            </View>
          </Animated.View>

          {isRequestRide && (
            <Animated.View
              entering={FadeInUp.delay(170).duration(300)}
              className="mx-5 mt-3"
            >
              <View className="rounded-[26px] border border-slate-200 bg-white p-4">
                <View className="mb-3 flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                      <Ionicons
                        name="hand-right-outline"
                        size={18}
                        color="#042F40"
                      />
                    </View>
                    <View>
                      <Text className="text-sm font-semibold text-slate-900">
                        <T>Request Details</T>
                      </Text>
                      <Text className="mt-1 text-xs text-slate-500">
                        <T>Passenger request waiting for your acceptance.</T>
                      </Text>
                    </View>
                  </View>
                  <View className="rounded-full bg-primary/10 px-3 py-1.5">
                    <Text className="text-xs font-semibold text-[#042F40]">
                      <T>Open</T>
                    </Text>
                  </View>
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1 rounded-2xl bg-slate-50 px-3 py-3">
                    <Text className="text-[11px] text-slate-500">
                      <T>Requested by</T>
                    </Text>
                    <Text className="mt-1 text-base font-bold text-slate-900">
                      {requesterName}
                    </Text>
                  </View>
                  <View className="flex-1 rounded-2xl bg-slate-50 px-3 py-3">
                    <Text className="text-[11px] text-slate-500">
                      <T>Seats</T>
                    </Text>
                    <Text className="mt-1 text-base font-bold text-slate-900">
                      {requestedSeats}
                    </Text>
                  </View>
                  <View className="flex-1 rounded-2xl bg-slate-50 px-3 py-3">
                    <Text className="text-[11px] text-slate-500">
                      <T>Fare</T>
                    </Text>
                    <Text className="mt-1 text-base font-bold text-slate-900">
                      ₦{Number(ride.fare || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Check-in Code */}
          {ride.check_in_code && (
            <Animated.View
              entering={FadeInUp.delay(200).duration(300)}
              className="mx-5 mt-3"
            >
              <View className="rounded-[26px] border border-slate-200 bg-white p-4">
                <View className="mb-3 flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-amber-50">
                      <Ionicons name="key-outline" size={18} color="#D4A017" />
                    </View>
                    <View>
                      <Text className="text-sm font-semibold text-slate-900">
                        <T>Check-In Code</T>
                      </Text>
                      <Text className="mt-1 text-xs text-slate-500">
                        <T>Share this code with passengers before pickup.</T>
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={handleShare}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 flex-row items-center"
                  >
                    <Ionicons name="share-outline" size={14} color="#334155" />
                    <Text className="ml-1 text-xs font-semibold text-slate-700">
                      <T>Share</T>
                    </Text>
                  </TouchableOpacity>
                </View>

                <View className="rounded-2xl bg-slate-50 px-4 py-4 items-center">
                  <Text className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <T>Boarding Code</T>
                  </Text>
                  <Text className="mt-1 text-2xl font-bold text-slate-900 tracking-[8px]">
                    {ride.check_in_code}
                  </Text>
                </View>
              </View>
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
                const isTransfer = bk.payment_method === "transfer";
                const paymentSent = isTransfer && bk.payment_status === "sent";
                const paymentConfirmed =
                  isTransfer && bk.payment_status === "paid";
                const passengerPhone = usr?.phone || null;
                return (
                  <Animated.View
                    key={bk._id}
                    entering={FadeInDown.delay(idx * 50).duration(250)}
                  >
                    <View className="mb-3 rounded-[26px] border border-slate-200 bg-white p-4">
                      <View className="mb-3 flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          {usr?.profile_picture ? (
                            <Image
                              source={{ uri: usr.profile_picture }}
                              className="mr-3 h-10 w-10 rounded-full"
                            />
                          ) : (
                            <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                              <Ionicons
                                name="person"
                                size={18}
                                color="#042F40"
                              />
                            </View>
                          )}
                          <View className="max-w-[70%]">
                            <Text className="text-sm font-semibold text-slate-900">
                              {usr?.name || "Passenger"}
                            </Text>
                            <Text className="mt-1 text-xs text-slate-500">
                              {passengerPhone || "Phone not added yet"}
                            </Text>
                          </View>
                        </View>

                        <View
                          className={`rounded-full px-3 py-1.5 ${bBadge.bg}`}
                        >
                          <Text
                            className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${bBadge.color}`}
                          >
                            <T>{bBadge.text}</T>
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row gap-3">
                        <View className="flex-1 rounded-2xl bg-slate-50 px-3 py-3">
                          <Text className="text-[11px] text-slate-500">
                            <T>Seats</T>
                          </Text>
                          <Text className="mt-1 text-base font-bold text-slate-900">
                            {bk.seats_requested}
                          </Text>
                        </View>
                        <View className="flex-1 rounded-2xl bg-slate-50 px-3 py-3">
                          <Text className="text-[11px] text-slate-500">
                            <T>Payment</T>
                          </Text>
                          <Text className="mt-1 text-base font-bold text-slate-900 capitalize">
                            {bk.payment_method}
                          </Text>
                        </View>
                        <View className="flex-1 rounded-2xl bg-slate-50 px-3 py-3">
                          <Text className="text-[11px] text-slate-500">
                            <T>Check-In</T>
                          </Text>
                          <Text className="mt-1 text-base font-bold text-slate-900">
                            {bk.check_in_status === "checked_in"
                              ? "In"
                              : "Waiting"}
                          </Text>
                        </View>
                      </View>

                      {isTransfer && (
                        <View
                          className={`mt-3 self-start rounded-full px-3 py-1.5 ${
                            paymentConfirmed
                              ? "bg-green-50"
                              : paymentSent
                                ? "bg-blue-50"
                                : "bg-amber-50"
                          }`}
                        >
                          <Text
                            className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
                              paymentConfirmed
                                ? "text-green-700"
                                : paymentSent
                                  ? "text-blue-700"
                                  : "text-amber-700"
                            }`}
                          >
                            {paymentConfirmed
                              ? "Transfer confirmed"
                              : paymentSent
                                ? "Transfer sent"
                                : "Transfer pending"}
                          </Text>
                        </View>
                      )}

                      <TouchableOpacity
                        onPress={() => handleCallPassenger(passengerPhone)}
                        disabled={!passengerPhone}
                        className={`mt-3 rounded-2xl border py-2.5 flex-row items-center justify-center ${
                          passengerPhone
                            ? "border-slate-900 bg-white"
                            : "border-slate-200 bg-slate-100"
                        }`}
                      >
                        <Ionicons
                          name="call-outline"
                          size={15}
                          color={passengerPhone ? "#0F172A" : "#94A3B8"}
                        />
                        <Text
                          className={`ml-2 text-xs font-semibold ${
                            passengerPhone ? "text-slate-900" : "text-slate-400"
                          }`}
                        >
                          <T>Call Passenger</T>
                        </Text>
                      </TouchableOpacity>

                      {/* Transfer payment confirm button — only when passenger has sent */}
                      {paymentSent &&
                        (bk.status === "accepted" ||
                          bk.status === "in_progress") && (
                          <TouchableOpacity
                            onPress={() =>
                              handleConfirmPayment(
                                bk._id,
                                usr?.name || "this passenger",
                              )
                            }
                            disabled={actionId === bk._id}
                            className="mt-2 rounded-2xl border border-blue-100 bg-blue-50 py-2.5 flex-row items-center justify-center"
                          >
                            {actionId === bk._id ? (
                              <ActivityIndicator size="small" color="#2563EB" />
                            ) : (
                              <>
                                <Ionicons
                                  name="checkmark-circle-outline"
                                  size={16}
                                  color="#2563EB"
                                />
                                <Text className="text-blue-600 font-semibold text-xs ml-1.5">
                                  <T>Confirm Transfer Received</T>
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}

                      {isPending && !settings.auto_accept_bookings && (
                        <View className="flex-row mt-3 gap-2">
                          <TouchableOpacity
                            onPress={() => handleAcceptBooking(bk._id)}
                            disabled={actionId === bk._id}
                            className="flex-1 rounded-2xl border border-[#042F40] bg-[#042F40] py-2.5 items-center"
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
                            className="flex-1 rounded-2xl border border-red-100 bg-red-50 py-2.5 items-center"
                          >
                            <Text className="text-red-600 font-semibold text-sm">
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

        {/* Bottom Action */}
        <SafeAreaView
          edges={["bottom"]}
          className="px-5 pt-3 pb-4 border-t border-gray-100 bg-white"
        >
          {isRequestRide ? (
            <TouchableOpacity
              onPress={handleAcceptRequest}
              className="rounded-2xl border border-[#042F40] bg-[#042F40] py-4 items-center flex-row justify-center"
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color="#FFFFFF"
              />
              <Text className="ml-2 text-white font-semibold text-base">
                <T>Accept Ride Request</T>
              </Text>
            </TouchableOpacity>
          ) : ride.status === "accepted" ||
            ride.status === "available" ||
            ride.status === "scheduled" ||
            ride.status === "in_progress" ? (
            <View>
              {/* Check-in progress indicator */}
              {totalPassengers > 0 && (
                <View className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <View className="flex-row items-center justify-between mb-1.5">
                    <View className="flex-row items-center">
                      <Ionicons
                        name={
                          allCheckedIn ? "checkmark-circle" : "time-outline"
                        }
                        size={14}
                        color={allCheckedIn ? "#16a34a" : "#d97706"}
                      />
                      <Text
                        className={`text-xs font-semibold ml-1 ${
                          allCheckedIn ? "text-green-600" : "text-amber-600"
                        }`}
                      >
                        {allCheckedIn ? (
                          <T>All passengers checked in</T>
                        ) : hasCheckedIn ? (
                          <>
                            {checkedInCount}/{totalPassengers} <T>checked in</T>
                          </>
                        ) : (
                          <T>Waiting for passenger check-in</T>
                        )}
                      </Text>
                    </View>
                    {!hasCheckedIn && ride.check_in_code && (
                      <TouchableOpacity
                        onPress={handleShare}
                        className="flex-row items-center"
                      >
                        <Ionicons
                          name="share-outline"
                          size={12}
                          color="#6B7280"
                        />
                        <Text className="text-xs text-gray-500 ml-1">
                          <T>Share Code</T>
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {/* Progress bar */}
                  <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <View
                      className={`h-full rounded-full ${
                        allCheckedIn
                          ? "bg-green-500"
                          : hasCheckedIn
                            ? "bg-amber-500"
                            : "bg-gray-200"
                      }`}
                      style={{
                        width:
                          totalPassengers > 0
                            ? `${(checkedInCount / totalPassengers) * 100}%`
                            : "0%",
                      }}
                    />
                  </View>
                </View>
              )}
              <TouchableOpacity
                onPress={handleStartRide}
                disabled={!canStartRide}
                className={`rounded-2xl border py-4 items-center flex-row justify-center ${
                  canStartRide
                    ? "border-[#042F40] bg-[#042F40]"
                    : "border-slate-200 bg-slate-100"
                }`}
              >
                <Ionicons
                  name={canStartRide ? "car" : "hourglass-outline"}
                  size={18}
                  color={canStartRide ? "#FFFFFF" : "#9CA3AF"}
                />
                <Text
                  className={`font-bold text-base ml-2 ${
                    canStartRide ? "text-white" : "text-gray-400"
                  }`}
                >
                  {canStartRide ? (
                    <T>Start Ride</T>
                  ) : totalPassengers === 0 ? (
                    <T>Waiting for Bookings</T>
                  ) : (
                    <T>Waiting for Check-in</T>
                  )}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </SafeAreaView>
      </SafeAreaView>
    </View>
  );
}
