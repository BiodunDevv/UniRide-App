import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  BackHandler,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";

import { useRideStore, Ride, Booking } from "@/store/useRideStore";
import { useAuthStore } from "@/store/useAuthStore";
import { usePlatformSettingsStore } from "@/store/usePlatformSettingsStore";
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

export default function RideDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    rideId?: string;
    bookingId?: string;
  }>();
  const { user } = useAuthStore();
  const { settings } = usePlatformSettingsStore();
  const {
    fetchRideDetails,
    bookRide,
    checkIn,
    cancelBooking,
    updatePaymentStatus,
    myBookings,
    fetchMyBookings,
    isBooking,
  } = useRideStore();

  const [ride, setRide] = useState<Ride | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [seats, setSeats] = useState(1);
  const [payMethod, setPayMethod] = useState<"cash" | "transfer">("cash");
  const [checkCode, setCheckCode] = useState(["", "", "", ""]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const codeRefs = useRef<(TextInput | null)[]>([null, null, null, null]);

  // ── Load data ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        // If we have a bookingId, find it from myBookings first
        if (params.bookingId) {
          await fetchMyBookings();
          const bk = useRideStore
            .getState()
            .myBookings.find((b) => b._id === params.bookingId);
          if (bk) {
            setBooking(bk);
            const rideId =
              typeof bk.ride_id === "object" ? bk.ride_id._id : bk.ride_id;
            if (rideId) {
              const r = await fetchRideDetails(rideId);
              setRide(r);
            }
          }
        } else if (params.rideId) {
          const r = await fetchRideDetails(params.rideId);
          setRide(r);
          // Check if user has a booking for this ride
          await fetchMyBookings();
          const bk = useRideStore
            .getState()
            .myBookings.find(
              (b) =>
                (typeof b.ride_id === "object" ? b.ride_id._id : b.ride_id) ===
                  params.rideId &&
                b.status !== "cancelled" &&
                b.status !== "declined",
            );
          if (bk) setBooking(bk);
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

  // ── Sync local state with store (real-time socket updates) ────────
  useEffect(() => {
    if (!booking) return;
    const updated = myBookings.find((b) => b._id === booking._id);
    if (updated && JSON.stringify(updated) !== JSON.stringify(booking)) {
      setBooking(updated);
    }
  }, [myBookings]);

  // Re-fetch ride when bookings update (ride status may have changed)
  useEffect(() => {
    const rideId =
      params.rideId ||
      (booking?.ride_id &&
        (typeof booking.ride_id === "object"
          ? booking.ride_id._id
          : booking.ride_id));
    if (rideId && !loading) {
      fetchRideDetails(rideId)
        .then(setRide)
        .catch(() => {});
    }
  }, [myBookings]);

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
  const maxSeats = Math.min(seatsLeft, settings.max_seats_per_booking || 10);
  const totalFare = settings.fare_per_seat
    ? ride?.fare
      ? ride.fare * seats
      : 0
    : ride?.fare || 0;
  const dep = ride?.departure_time ? new Date(ride.departure_time) : null;
  const dist = ride?.distance_meters
    ? `${(ride.distance_meters / 1000).toFixed(1)} km`
    : null;
  const dur = ride?.duration_seconds
    ? `${Math.round(ride.duration_seconds / 60)} min`
    : null;
  const canBook =
    ride &&
    !booking &&
    (ride.status === "available" || ride.status === "scheduled") &&
    seatsLeft > 0;
  const needsCheckIn =
    booking?.status === "accepted" && booking?.check_in_status !== "checked_in";
  const isCheckedIn = booking?.check_in_status === "checked_in";
  const inProgress = ride?.status === "in_progress";
  const isTransfer = booking?.payment_method === "transfer";
  const canMarkSent =
    isTransfer &&
    booking?.payment_status === "pending" &&
    (booking?.status === "accepted" || isCheckedIn);

  // ── Book ──────────────────────────────────────────────────────────
  const handleBook = async () => {
    if (!ride) return;
    try {
      const res = await bookRide(ride._id, payMethod, seats);
      setBooking(res.data || res);
      if (settings.auto_accept_bookings) {
        Alert.alert("Confirmed!", "Your booking has been auto-confirmed.");
      } else {
        Alert.alert("Booked!", "Waiting for driver confirmation.");
      }
      fetchMyBookings();
    } catch (e: any) {
      Alert.alert(
        "Error",
        e?.response?.data?.message || e?.message || "Booking failed",
      );
    }
  };

  // ── Check-in ──────────────────────────────────────────────────────
  const handleCheckIn = async () => {
    if (!booking) return;
    const code = checkCode.join("");
    if (code.length < 4) {
      Alert.alert("Error", "Enter the 4-digit code");
      return;
    }
    setCheckingIn(true);
    try {
      await checkIn(booking._id, code);
      Alert.alert("Checked In!", "You're all set for the ride.");
      fetchMyBookings();
      const bk = {
        ...booking,
        check_in_status: "checked_in" as const,
      };
      setBooking(bk);
    } catch (e: any) {
      Alert.alert(
        "Invalid Code",
        e?.response?.data?.message || "Check-in failed",
      );
    }
    setCheckingIn(false);
  };

  // ── Cancel ────────────────────────────────────────────────────────
  const handleCancel = () => {
    if (!booking) return;
    Alert.alert("Cancel Booking", "Are you sure?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          setCancelling(true);
          try {
            await cancelBooking(booking._id);
            setBooking({ ...booking, status: "cancelled" });
            fetchMyBookings();
          } catch (e: any) {
            Alert.alert("Error", e?.message || "Failed");
          }
          setCancelling(false);
        },
      },
    ]);
  };

  // ── Mark Transfer Sent ────────────────────────────────────────────
  const handleMarkSent = () => {
    if (!booking) return;
    Alert.alert(
      "Confirm Transfer",
      "Have you sent the transfer payment to the driver's bank account?",
      [
        { text: "Not Yet", style: "cancel" },
        {
          text: "Yes, I've Sent It",
          onPress: async () => {
            setMarkingPaid(true);
            try {
              await updatePaymentStatus(booking._id, "sent");
              setBooking({ ...booking, payment_status: "sent" as const });
              fetchMyBookings();
              Alert.alert(
                "Transfer Noted",
                "Your driver will be notified to confirm receipt.",
              );
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Failed to update");
            }
            setMarkingPaid(false);
          },
        },
      ],
    );
  };

  // ── Code input ────────────────────────────────────────────────────
  const handleCodeChange = (text: string, idx: number) => {
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    const next = [...checkCode];
    next[idx] = digit;
    setCheckCode(next);
    if (digit && idx < 3) codeRefs.current[idx + 1]?.focus();
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

  const badge =
    STATUS_BADGES[booking?.status || ride.status] || STATUS_BADGES.available;

  // ═════════════════════════════════════════════════════════════════════
  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={["top"]} className="flex-1">
        {/* ── Header ─────────────────────────────────────────────── */}
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

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 120 }}
          >
            {/* ── Route ───────────────────────────────────────────── */}
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
                    {pickup?.short_name ||
                      pickup?.name ||
                      ride.pickup_location?.address ||
                      "Pickup"}
                  </Text>
                  <Text className="text-xs text-gray-400 mb-5">
                    {pickup?.address || ""}
                  </Text>
                  <Text className="text-sm font-semibold text-gray-800">
                    {dest?.short_name ||
                      dest?.name ||
                      ride.destination?.address ||
                      "Destination"}
                  </Text>
                  <Text className="text-xs text-gray-400">
                    {dest?.address || ""}
                  </Text>
                </View>
              </View>
              {/* Stats */}
              <View className="flex-row mt-4 pt-3 border-t border-gray-200 gap-3">
                {dep && (
                  <View className="flex-1 items-center">
                    <Ionicons name="time-outline" size={16} color="#6B7280" />
                    <Text className="text-xs text-gray-500 mt-1">
                      {dep.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    <Text className="text-xs font-semibold text-gray-700">
                      {dep.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                )}
                {dist && (
                  <View className="flex-1 items-center">
                    <Ionicons
                      name="navigate-outline"
                      size={16}
                      color="#6B7280"
                    />
                    <Text className="text-xs text-gray-500 mt-1">
                      <T>Distance</T>
                    </Text>
                    <Text className="text-xs font-semibold text-gray-700">
                      {dist}
                    </Text>
                  </View>
                )}
                {dur && (
                  <View className="flex-1 items-center">
                    <Ionicons name="timer-outline" size={16} color="#6B7280" />
                    <Text className="text-xs text-gray-500 mt-1">
                      <T>Duration</T>
                    </Text>
                    <Text className="text-xs font-semibold text-gray-700">
                      {dur}
                    </Text>
                  </View>
                )}
                <View className="flex-1 items-center">
                  <Ionicons name="people-outline" size={16} color="#6B7280" />
                  <Text className="text-xs text-gray-500 mt-1">
                    <T>Seats Left</T>
                  </Text>
                  <Text className="text-xs font-semibold text-gray-700">
                    {seatsLeft}
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* ── Driver Info ─────────────────────────────────────── */}
            {driver && (
              <Animated.View
                entering={FadeInUp.delay(200).duration(300)}
                className="mx-5 mt-3 bg-gray-50 rounded-2xl p-4 flex-row items-center"
              >
                <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mr-3">
                  <Ionicons name="person" size={24} color="#042F40" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-800">
                    {driver.name || "Driver"}
                  </Text>
                  {driver.vehicle_make && (
                    <Text className="text-xs text-gray-400">
                      {driver.vehicle_make} {driver.vehicle_model} ·{" "}
                      {driver.vehicle_color}
                    </Text>
                  )}
                  {driver.vehicle_plate_number && (
                    <Text className="text-xs text-gray-400">
                      {driver.vehicle_plate_number}
                    </Text>
                  )}
                </View>
                {driver.rating && (
                  <View className="flex-row items-center bg-accent/10 rounded-full px-2.5 py-1">
                    <Ionicons name="star" size={12} color="#D4A017" />
                    <Text className="text-xs font-bold text-accent ml-1">
                      {typeof driver.rating === "number"
                        ? driver.rating.toFixed(1)
                        : driver.rating}
                    </Text>
                  </View>
                )}
              </Animated.View>
            )}

            {/* ── Fare ────────────────────────────────────────────── */}
            <Animated.View
              entering={FadeInUp.delay(250).duration(300)}
              className="mx-5 mt-3 bg-primary/5 rounded-2xl p-4"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-gray-600">
                  <T>Fare</T>
                </Text>
                <View className="flex-row items-baseline">
                  <Text className="text-2xl font-bold text-primary">
                    ₦{totalFare}
                  </Text>
                  {settings.fare_per_seat && seats > 1 && (
                    <Text className="text-xs text-gray-400 ml-2">
                      ₦{ride.fare} × {seats}
                    </Text>
                  )}
                </View>
              </View>
            </Animated.View>

            {/* ── Check-In Section ─────────────────────────────────── */}
            {needsCheckIn && (
              <Animated.View
                entering={FadeInUp.delay(300).duration(300)}
                className="mx-5 mt-4"
              >
                <View className="bg-accent/5 rounded-2xl p-5 border border-accent/20">
                  <View className="items-center mb-4">
                    <View className="w-14 h-14 rounded-full bg-accent/10 items-center justify-center mb-2">
                      <Ionicons name="key" size={28} color="#D4A017" />
                    </View>
                    <Text className="text-lg font-bold text-gray-900">
                      <T>Check In</T>
                    </Text>
                    <Text className="text-sm text-gray-500 text-center mt-1">
                      <T>Enter the 4-digit code from your driver</T>
                    </Text>
                  </View>
                  <View className="flex-row justify-center gap-3 mb-5">
                    {checkCode.map((d, i) => (
                      <TextInput
                        key={i}
                        ref={(r) => {
                          codeRefs.current[i] = r;
                        }}
                        value={d}
                        onChangeText={(t) => handleCodeChange(t, i)}
                        keyboardType="number-pad"
                        maxLength={1}
                        className="w-14 h-16 bg-white rounded-2xl text-center text-2xl font-bold text-gray-800 border-2"
                        style={{ borderColor: d ? "#D4A017" : "#E5E7EB" }}
                        onKeyPress={({ nativeEvent }) => {
                          if (nativeEvent.key === "Backspace" && !d && i > 0)
                            codeRefs.current[i - 1]?.focus();
                        }}
                      />
                    ))}
                  </View>
                  <TouchableOpacity
                    onPress={handleCheckIn}
                    disabled={checkingIn || checkCode.join("").length < 4}
                    className={`rounded-2xl py-4 items-center ${checkCode.join("").length === 4 ? "bg-accent" : "bg-gray-200"}`}
                  >
                    {checkingIn ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text
                        className={`font-bold text-base ${checkCode.join("").length === 4 ? "text-white" : "text-gray-400"}`}
                      >
                        <T>Verify & Check In</T>
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}

            {/* ── Checked In Banner ─────────────────────────────── */}
            {isCheckedIn && !inProgress && (
              <Animated.View
                entering={FadeInUp.delay(300).duration(300)}
                className="mx-5 mt-4"
              >
                <View className="bg-green-50 rounded-2xl p-4 flex-row items-center border border-green-100">
                  <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center mr-3">
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#16A34A"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-green-800">
                      <T>Checked In</T>
                    </Text>
                    <Text className="text-xs text-green-600 mt-0.5">
                      <T>Waiting for the driver to start the ride</T>
                    </Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* ── In Progress Banner ──────────────────────────────── */}
            {inProgress && (
              <Animated.View
                entering={FadeInUp.delay(300).duration(300)}
                className="mx-5 mt-4"
              >
                <View className="bg-blue-50 rounded-2xl p-4 flex-row items-center border border-blue-100">
                  <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                    <Ionicons name="navigate" size={20} color="#2563EB" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-blue-800">
                      <T>Ride In Progress</T>
                    </Text>
                    <Text className="text-xs text-blue-500 mt-0.5">
                      <T>Enjoy your ride!</T>
                    </Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* ── Booking Info ─────────────────────────────────────── */}
            {booking && booking.status !== "cancelled" && (
              <Animated.View
                entering={FadeInUp.delay(350).duration(300)}
                className="mx-5 mt-3 bg-gray-50 rounded-2xl p-4"
              >
                <Text className="text-xs font-semibold text-gray-400 uppercase mb-3">
                  <T>Your Booking</T>
                </Text>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-xs text-gray-500">
                    <T>Seats</T>
                  </Text>
                  <Text className="text-xs font-semibold text-gray-800">
                    {booking.seats_requested}
                  </Text>
                </View>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-xs text-gray-500">
                    <T>Payment</T>
                  </Text>
                  <Text className="text-xs font-semibold text-gray-800 capitalize">
                    {booking.payment_method}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-gray-500">
                    <T>Status</T>
                  </Text>
                  <View
                    className={`px-2 py-0.5 rounded-full ${STATUS_BADGES[booking.status]?.bg || "bg-gray-100"}`}
                  >
                    <Text
                      className={`text-[10px] font-semibold ${STATUS_BADGES[booking.status]?.color || "text-gray-500"}`}
                    >
                      {booking.status}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* ── Transfer Payment Section ─────────────────────────── */}
            {booking &&
              isTransfer &&
              booking.status !== "cancelled" &&
              booking.status !== "declined" && (
                <Animated.View
                  entering={FadeInUp.delay(375).duration(300)}
                  className="mx-5 mt-3"
                >
                  <View
                    className={`rounded-2xl p-4 border ${
                      booking.payment_status === "paid"
                        ? "bg-green-50 border-green-100"
                        : booking.payment_status === "sent"
                          ? "bg-blue-50 border-blue-100"
                          : "bg-amber-50 border-amber-100"
                    }`}
                  >
                    <View className="flex-row items-center mb-2">
                      <View
                        className={`w-9 h-9 rounded-full items-center justify-center mr-3 ${
                          booking.payment_status === "paid"
                            ? "bg-green-100"
                            : booking.payment_status === "sent"
                              ? "bg-blue-100"
                              : "bg-amber-100"
                        }`}
                      >
                        <Ionicons
                          name={
                            booking.payment_status === "paid"
                              ? "checkmark-circle"
                              : booking.payment_status === "sent"
                                ? "time"
                                : "card-outline"
                          }
                          size={18}
                          color={
                            booking.payment_status === "paid"
                              ? "#16A34A"
                              : booking.payment_status === "sent"
                                ? "#2563EB"
                                : "#D97706"
                          }
                        />
                      </View>
                      <View className="flex-1">
                        <Text
                          className={`text-sm font-semibold ${
                            booking.payment_status === "paid"
                              ? "text-green-700"
                              : booking.payment_status === "sent"
                                ? "text-blue-700"
                                : "text-amber-700"
                          }`}
                        >
                          {booking.payment_status === "paid" ? (
                            <T>Payment Confirmed</T>
                          ) : booking.payment_status === "sent" ? (
                            <T>Awaiting Driver Confirmation</T>
                          ) : (
                            <T>Transfer Payment Required</T>
                          )}
                        </Text>
                        <Text className="text-xs text-gray-500 mt-0.5">
                          {booking.payment_status === "paid" ? (
                            <T>Driver confirmed receiving your payment</T>
                          ) : booking.payment_status === "sent" ? (
                            <T>Driver will confirm receipt shortly</T>
                          ) : (
                            <T>{`Send ₦${booking.total_fare || ride?.fare || 0} to the driver's bank account`}</T>
                          )}
                        </Text>
                      </View>
                    </View>
                    {canMarkSent && (
                      <TouchableOpacity
                        onPress={handleMarkSent}
                        disabled={markingPaid}
                        className="bg-amber-500 rounded-xl py-3 items-center mt-1 flex-row justify-center"
                      >
                        {markingPaid ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="send" size={14} color="#FFFFFF" />
                            <Text className="text-white font-bold text-sm ml-2">
                              <T>I've Sent the Money</T>
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </Animated.View>
              )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Bottom Actions ──────────────────────────────────────── */}
        {(canBook ||
          (booking &&
            (booking.status === "pending" ||
              booking.status === "accepted"))) && (
          <SafeAreaView
            edges={["bottom"]}
            className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 pt-3"
          >
            {canBook ? (
              <Animated.View entering={FadeInDown.duration(300)}>
                {/* Seat Selector */}
                {maxSeats > 1 && (
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-sm text-gray-600">
                      <T>Seats</T>
                    </Text>
                    <View className="flex-row items-center gap-3">
                      <TouchableOpacity
                        onPress={() => setSeats(Math.max(1, seats - 1))}
                        className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                      >
                        <Ionicons name="remove" size={16} color="#042F40" />
                      </TouchableOpacity>
                      <Text className="text-lg font-bold text-gray-800 w-6 text-center">
                        {seats}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setSeats(Math.min(maxSeats, seats + 1))}
                        className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                      >
                        <Ionicons name="add" size={16} color="#042F40" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {/* Payment Select */}
                <View className="flex-row gap-2 mb-3">
                  {(["cash", "transfer"] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setPayMethod(m)}
                      className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center ${payMethod === m ? "bg-primary" : "bg-gray-100"}`}
                    >
                      <Ionicons
                        name={m === "cash" ? "cash-outline" : "card-outline"}
                        size={16}
                        color={payMethod === m ? "#fff" : "#6B7280"}
                      />
                      <Text
                        className={`ml-2 text-sm font-semibold ${payMethod === m ? "text-white" : "text-gray-600"}`}
                      >
                        {m === "cash" ? "Cash" : "Transfer"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  onPress={handleBook}
                  disabled={isBooking}
                  className="bg-primary rounded-2xl py-4 items-center mb-2"
                >
                  {isBooking ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold text-base">
                      <T>Book Ride</T> · ₦{totalFare}
                    </Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            ) : booking &&
              (booking.status === "pending" ||
                booking.status === "accepted") ? (
              <TouchableOpacity
                onPress={handleCancel}
                disabled={cancelling}
                className="bg-red-50 rounded-2xl py-4 items-center mb-2 border border-red-100"
              >
                {cancelling ? (
                  <ActivityIndicator color="#EF4444" />
                ) : (
                  <Text className="text-red-500 font-bold text-sm">
                    <T>Cancel Booking</T>
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}
          </SafeAreaView>
        )}
      </SafeAreaView>
    </View>
  );
}
