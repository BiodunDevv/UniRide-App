import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, Alert, BackHandler,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Image, Linking,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";

import { useRideStore, Ride, Booking } from "@/store/useRideStore";
import { useAuthStore } from "@/store/useAuthStore";
import { usePlatformSettingsStore } from "@/store/usePlatformSettingsStore";
import { useSocket } from "@/hooks/use-socket";
import { eventBus } from "@/lib/eventBus";
import { T } from "@/hooks/use-translation";

const STATUS_BADGES: Record<string, { bg: string; text: string; color: string }> = {
  scheduled: { bg: "bg-purple-50", text: "Scheduled", color: "text-purple-600" },
  available: { bg: "bg-green-50", text: "Available", color: "text-green-600" },
  accepted: { bg: "bg-blue-50", text: "Accepted", color: "text-blue-600" },
  in_progress: { bg: "bg-amber-50", text: "In Progress", color: "text-amber-600" },
  completed: { bg: "bg-gray-50", text: "Completed", color: "text-gray-500" },
  cancelled: { bg: "bg-red-50", text: "Cancelled", color: "text-red-500" },
  pending: { bg: "bg-yellow-50", text: "Pending", color: "text-yellow-600" },
  declined: { bg: "bg-red-50", text: "Declined", color: "text-red-500" },
};

export default function RideDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ rideId?: string; bookingId?: string }>();
  const { user } = useAuthStore();
  const { settings } = usePlatformSettingsStore();
  const { fetchRideDetails, bookRide, checkIn, cancelBooking, updatePaymentStatus, fetchMyBookings, isBooking } = useRideStore();
  const { joinRide, leaveRide } = useSocket();

  const [ride, setRide] = useState<Ride | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [seats, setSeats] = useState(1);
  const [payMethod, setPayMethod] = useState<"cash" | "transfer">("cash");
  const [checkCode, setCheckCode] = useState(["", "", "", ""]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState(false);
  const codeRefs = useRef<(TextInput | null)[]>([null, null, null, null]);
  const rideIdRef = useRef<string | null>(null);

  // ── Load data ─────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      if (params.bookingId) {
        await fetchMyBookings();
        const bk = useRideStore.getState().myBookings.find((b) => b._id === params.bookingId);
        if (bk) {
          setBooking(bk);
          const rid = typeof bk.ride_id === "object" ? bk.ride_id._id : bk.ride_id;
          if (rid) { const r = await fetchRideDetails(rid); setRide(r); rideIdRef.current = rid; joinRide(rid); }
        }
      } else if (params.rideId) {
        const r = await fetchRideDetails(params.rideId); setRide(r);
        rideIdRef.current = params.rideId; joinRide(params.rideId);
        await fetchMyBookings();
        const bk = useRideStore.getState().myBookings.find(
          (b) => (typeof b.ride_id === "object" ? b.ride_id._id : b.ride_id) === params.rideId && b.status !== "cancelled" && b.status !== "declined",
        );
        if (bk) setBooking(bk);
      }
    } catch (e: any) { Alert.alert("Error", e?.message || "Failed to load"); }
    setLoading(false);
  }, [params.rideId, params.bookingId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Socket real-time ──────────────────────────────────────────────
  useEffect(() => {
    const refresh = () => {
      if (rideIdRef.current) fetchRideDetails(rideIdRef.current).then(setRide).catch(() => {});
      fetchMyBookings().then(() => {
        if (params.bookingId) {
          const bk = useRideStore.getState().myBookings.find((b) => b._id === params.bookingId);
          if (bk) setBooking(bk);
        } else if (params.rideId) {
          const bk = useRideStore.getState().myBookings.find(
            (b) => (typeof b.ride_id === "object" ? b.ride_id._id : b.ride_id) === params.rideId && b.status !== "cancelled" && b.status !== "declined",
          );
          if (bk) setBooking(bk);
        }
      });
    };
    const u1 = eventBus.on("booking:updated", refresh);
    const u2 = eventBus.on("booking:cancelled", refresh);
    const u3 = eventBus.on("booking:checkin", refresh);
    const u4 = eventBus.on("ride:accepted", refresh);
    const u5 = eventBus.on("ride:ended", refresh);
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [params.rideId, params.bookingId]);

  useEffect(() => { return () => { if (rideIdRef.current) leaveRide(rideIdRef.current); }; }, []);
  useEffect(() => { const s = BackHandler.addEventListener("hardwareBackPress", () => { router.back(); return true; }); return () => s.remove(); }, []);

  // ── Derived ───────────────────────────────────────────────────────
  const pickup = ride && typeof ride.pickup_location_id === "object" ? ride.pickup_location_id : null;
  const dest = ride && typeof ride.destination_id === "object" ? ride.destination_id : null;
  const driverObj: any = ride?.driver_id && typeof ride.driver_id === "object" ? ride.driver_id : null;
  const driverUser: any = driverObj?.user_id && typeof driverObj.user_id === "object" ? driverObj.user_id : null;
  const seatsLeft = ride ? (ride.seats_remaining ?? ride.available_seats - ride.booked_seats) : 0;
  const maxSeats = Math.min(Math.max(seatsLeft, 1), settings.max_seats_per_booking || 10);
  const bookingFare = booking?.total_fare;
  const totalFare = bookingFare ?? (settings.fare_per_seat ? (ride?.fare ? ride.fare * seats : 0) : ride?.fare || 0);
  const dep = ride?.departure_time ? new Date(ride.departure_time) : null;
  const dist = ride?.distance_meters ? `${(ride.distance_meters / 1000).toFixed(1)} km` : null;
  const dur = ride?.duration_seconds ? `${Math.round(ride.duration_seconds / 60)} min` : null;
  const canBook = ride && !booking && (ride.status === "available" || ride.status === "scheduled") && seatsLeft > 0;
  const needsCheckIn = booking?.status === "accepted" && booking?.check_in_status !== "checked_in";
  const inProgress = booking?.status === "in_progress";
  const showBankDetails = booking && booking.payment_method === "transfer" && (booking.status === "accepted" || booking.status === "in_progress") && driverObj?.bank_account_number;

  // ── Handlers ──────────────────────────────────────────────────────
  const handleBook = async () => {
    if (!ride) return;
    try {
      const res = await bookRide(ride._id, payMethod, seats);
      setBooking(res.data || res);
      if (settings.auto_accept_bookings) Alert.alert("Confirmed!", "Your booking has been auto-confirmed.");
      else Alert.alert("Booked!", "Waiting for driver confirmation.");
      fetchMyBookings(); fetchRideDetails(ride._id).then(setRide).catch(() => {});
    } catch (e: any) { Alert.alert("Error", e?.response?.data?.message || e?.message || "Booking failed"); }
  };

  const handleCheckIn = async () => {
    if (!booking) return;
    const code = checkCode.join(""); if (code.length < 4) { Alert.alert("Error", "Enter the 4-digit code"); return; }
    setCheckingIn(true);
    try { await checkIn(booking._id, code); Alert.alert("Checked In!", "You're all set for the ride."); fetchMyBookings(); setBooking({ ...booking, check_in_status: "checked_in" as const, status: "in_progress" as const }); }
    catch (e: any) { Alert.alert("Invalid Code", e?.response?.data?.message || "Check-in failed"); }
    setCheckingIn(false);
  };

  const handleMarkPaid = async () => {
    if (!booking) return;
    try { await updatePaymentStatus(booking._id, "paid"); setBooking({ ...booking, payment_status: "paid" }); Alert.alert("Done", "Payment marked as paid."); }
    catch (e: any) { Alert.alert("Error", e?.message || "Failed"); }
  };

  const handleCancel = () => {
    if (!booking) return;
    Alert.alert("Cancel Booking", "Are you sure?", [
      { text: "No", style: "cancel" },
      { text: "Yes, Cancel", style: "destructive", onPress: async () => {
        setCancelling(true);
        try { await cancelBooking(booking._id); setBooking({ ...booking, status: "cancelled" }); fetchMyBookings(); }
        catch (e: any) { Alert.alert("Error", e?.message || "Failed"); }
        setCancelling(false);
      }},
    ]);
  };

  const handleCodeChange = (text: string, idx: number) => {
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    const next = [...checkCode]; next[idx] = digit; setCheckCode(next);
    if (digit && idx < 3) codeRefs.current[idx + 1]?.focus();
  };

  const copyAcct = async (text: string) => { await Clipboard.setStringAsync(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  if (loading) return (<View className="flex-1 items-center justify-center bg-white"><ActivityIndicator size="large" color="#042F40" /></View>);
  if (!ride) return (<View className="flex-1 items-center justify-center bg-white"><Text className="text-gray-400"><T>Ride not found</T></Text></View>);

  const badge = STATUS_BADGES[booking?.status || ride.status] || STATUS_BADGES.available;
  const driverName = driverUser?.name || driverObj?.name || "Driver";
  const driverPic = driverUser?.profile_picture || driverObj?.profile_picture;
  const driverInitials = driverName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={["top"]} className="flex-1">
        {/* Header */}
        <Animated.View entering={FadeInUp.duration(300)} className="px-5 pt-3 pb-2 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3">
            <Ionicons name="arrow-back" size={20} color="#042F40" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900 flex-1"><T>Ride Details</T></Text>
          <View className={`px-3 py-1 rounded-full ${badge.bg}`}><Text className={`text-xs font-semibold ${badge.color}`}><T>{badge.text}</T></Text></View>
        </Animated.View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
          <ScrollView showsVerticalScrollIndicator={false} className="flex-1" contentContainerStyle={{ paddingBottom: 140 }}>
            {/* Route */}
            <Animated.View entering={FadeInUp.delay(100).duration(300)} className="mx-5 mt-3 bg-gray-50 rounded-2xl p-4">
              <View className="flex-row items-start">
                <View className="items-center mr-3 mt-1">
                  <View className="w-3 h-3 rounded-full bg-green-500" /><View className="w-0.5 h-10 bg-gray-300 my-1" /><View className="w-3 h-3 rounded-full bg-red-500" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-800">{pickup?.short_name || pickup?.name || ride.pickup_location?.address || "Pickup"}</Text>
                  <Text className="text-xs text-gray-400 mb-5">{pickup?.address || ""}</Text>
                  <Text className="text-sm font-semibold text-gray-800">{dest?.short_name || dest?.name || ride.destination?.address || "Destination"}</Text>
                  <Text className="text-xs text-gray-400">{dest?.address || ""}</Text>
                </View>
              </View>
              <View className="flex-row mt-4 pt-3 border-t border-gray-200 gap-3">
                {dep && (<View className="flex-1 items-center"><Ionicons name="time-outline" size={16} color="#6B7280" /><Text className="text-xs text-gray-500 mt-1">{dep.toLocaleDateString([], { month: "short", day: "numeric" })}</Text><Text className="text-xs font-semibold text-gray-700">{dep.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text></View>)}
                {dist && (<View className="flex-1 items-center"><Ionicons name="navigate-outline" size={16} color="#6B7280" /><Text className="text-xs text-gray-500 mt-1"><T>Distance</T></Text><Text className="text-xs font-semibold text-gray-700">{dist}</Text></View>)}
                {dur && (<View className="flex-1 items-center"><Ionicons name="timer-outline" size={16} color="#6B7280" /><Text className="text-xs text-gray-500 mt-1"><T>Duration</T></Text><Text className="text-xs font-semibold text-gray-700">{dur}</Text></View>)}
                <View className="flex-1 items-center"><Ionicons name="people-outline" size={16} color="#6B7280" /><Text className="text-xs text-gray-500 mt-1"><T>Seats Left</T></Text><Text className="text-xs font-semibold text-gray-700">{seatsLeft}</Text></View>
              </View>
            </Animated.View>

            {/* Driver Full Card */}
            {driverObj && (
              <Animated.View entering={FadeInUp.delay(200).duration(300)} className="mx-5 mt-3 bg-gray-50 rounded-2xl p-4">
                <View className="flex-row items-center mb-3">
                  {driverPic ? (<Image source={{ uri: driverPic }} className="w-14 h-14 rounded-full" />) : (
                    <View className="w-14 h-14 rounded-full bg-primary/10 items-center justify-center"><Text className="text-lg font-bold text-primary">{driverInitials}</Text></View>
                  )}
                  <View className="flex-1 ml-3">
                    <Text className="text-base font-bold text-gray-900">{driverName}</Text>
                    <View className="flex-row items-center mt-0.5">
                      <Ionicons name="star" size={12} color="#D4A017" />
                      <Text className="text-xs font-semibold text-accent ml-1">{typeof driverObj.rating === "number" ? driverObj.rating.toFixed(1) : "5.0"}</Text>
                      {driverObj.total_ratings > 0 && (<Text className="text-[10px] text-gray-400 ml-1">({driverObj.total_ratings})</Text>)}
                    </View>
                  </View>
                  {driverObj.phone && (
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${driverObj.phone}`)} className="w-10 h-10 rounded-full bg-green-50 items-center justify-center">
                      <Ionicons name="call" size={18} color="#16A34A" />
                    </TouchableOpacity>
                  )}
                </View>
                <View className="bg-white rounded-xl p-3 border border-gray-100">
                  {driverObj.vehicle_image && (<Image source={{ uri: driverObj.vehicle_image }} className="w-full h-32 rounded-lg mb-3" resizeMode="cover" />)}
                  <View className="flex-row flex-wrap gap-y-2">
                    <View className="w-1/2"><Text className="text-[10px] text-gray-400 uppercase"><T>Model</T></Text><Text className="text-xs font-semibold text-gray-800">{driverObj.vehicle_model || "—"}</Text></View>
                    <View className="w-1/2"><Text className="text-[10px] text-gray-400 uppercase"><T>Color</T></Text><Text className="text-xs font-semibold text-gray-800">{driverObj.vehicle_color || "—"}</Text></View>
                    <View className="w-1/2"><Text className="text-[10px] text-gray-400 uppercase"><T>Plate</T></Text><Text className="text-xs font-bold text-primary tracking-wider">{driverObj.plate_number || "—"}</Text></View>
                    <View className="w-1/2"><Text className="text-[10px] text-gray-400 uppercase"><T>Seats</T></Text><Text className="text-xs font-semibold text-gray-800">{driverObj.available_seats || ride.available_seats}</Text></View>
                  </View>
                  {driverObj.vehicle_description ? (<Text className="text-xs text-gray-500 mt-2 italic">{driverObj.vehicle_description}</Text>) : null}
                </View>
              </Animated.View>
            )}

            {/* Fare */}
            <Animated.View entering={FadeInUp.delay(250).duration(300)} className="mx-5 mt-3 bg-primary/5 rounded-2xl p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-gray-600"><T>Fare</T></Text>
                <View className="flex-row items-baseline">
                  <Text className="text-2xl font-bold text-primary">₦{totalFare}</Text>
                  {settings.fare_per_seat && seats > 1 && !booking && (<Text className="text-xs text-gray-400 ml-2">₦{ride.fare} × {seats}</Text>)}
                </View>
              </View>
              {booking && settings.fare_per_seat && booking.seats_requested > 1 && (
                <Text className="text-[10px] text-gray-400 text-right mt-1">₦{ride.fare} × {booking.seats_requested} seat{booking.seats_requested > 1 ? "s" : ""}</Text>
              )}
            </Animated.View>

            {/* Bank Details (Transfer) */}
            {showBankDetails && (
              <Animated.View entering={FadeInUp.delay(280).duration(300)} className="mx-5 mt-3">
                <View className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                  <View className="flex-row items-center mb-3">
                    <View className="w-9 h-9 rounded-full bg-blue-100 items-center justify-center mr-3"><Ionicons name="card" size={18} color="#2563EB" /></View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-blue-900"><T>Transfer Payment</T></Text>
                      <Text className="text-[10px] text-blue-500"><T>Send fare to driver's account</T></Text>
                    </View>
                    {booking.payment_status === "paid" && (<View className="bg-green-100 rounded-full px-2.5 py-1"><Text className="text-[10px] font-bold text-green-700"><T>Paid</T></Text></View>)}
                  </View>
                  <View className="bg-white rounded-xl p-3 border border-blue-50">
                    <View className="flex-row justify-between items-center mb-2"><Text className="text-[10px] text-gray-400 uppercase"><T>Bank</T></Text><Text className="text-xs font-semibold text-gray-800">{driverObj?.bank_name || "—"}</Text></View>
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className="text-[10px] text-gray-400 uppercase"><T>Account No.</T></Text>
                      <TouchableOpacity onPress={() => copyAcct(driverObj?.bank_account_number || "")} className="flex-row items-center">
                        <Text className="text-sm font-bold text-primary tracking-wider mr-2">{driverObj?.bank_account_number}</Text>
                        <Ionicons name={copied ? "checkmark-circle" : "copy-outline"} size={14} color={copied ? "#16A34A" : "#6B7280"} />
                      </TouchableOpacity>
                    </View>
                    <View className="flex-row justify-between items-center mb-2"><Text className="text-[10px] text-gray-400 uppercase"><T>Name</T></Text><Text className="text-xs font-semibold text-gray-800">{driverObj?.bank_account_name || "—"}</Text></View>
                    <View className="flex-row justify-between items-center"><Text className="text-[10px] text-gray-400 uppercase"><T>Amount</T></Text><Text className="text-base font-bold text-primary">₦{totalFare}</Text></View>
                  </View>
                  {booking.payment_status !== "paid" && (
                    <TouchableOpacity onPress={handleMarkPaid} className="bg-blue-600 rounded-xl py-3 items-center mt-3"><Text className="text-white font-bold text-sm"><T>I've Sent the Money</T></Text></TouchableOpacity>
                  )}
                </View>
              </Animated.View>
            )}

            {/* Check-In */}
            {needsCheckIn && (
              <Animated.View entering={FadeInUp.delay(300).duration(300)} className="mx-5 mt-4">
                <View className="bg-accent/5 rounded-2xl p-5 border border-accent/20">
                  <View className="items-center mb-4">
                    <View className="w-14 h-14 rounded-full bg-accent/10 items-center justify-center mb-2"><Ionicons name="key" size={28} color="#D4A017" /></View>
                    <Text className="text-lg font-bold text-gray-900"><T>Check In</T></Text>
                    <Text className="text-sm text-gray-500 text-center mt-1"><T>Enter the 4-digit code from your driver</T></Text>
                  </View>
                  <View className="flex-row justify-center gap-3 mb-5">
                    {checkCode.map((d, i) => (
                      <TextInput key={i} ref={(r) => { codeRefs.current[i] = r; }} value={d} onChangeText={(t) => handleCodeChange(t, i)} keyboardType="number-pad" maxLength={1}
                        className="w-14 h-16 bg-white rounded-2xl text-center text-2xl font-bold text-gray-800 border-2" style={{ borderColor: d ? "#D4A017" : "#E5E7EB" }}
                        onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === "Backspace" && !d && i > 0) codeRefs.current[i - 1]?.focus(); }} />
                    ))}
                  </View>
                  <TouchableOpacity onPress={handleCheckIn} disabled={checkingIn || checkCode.join("").length < 4} className={`rounded-2xl py-4 items-center ${checkCode.join("").length === 4 ? "bg-accent" : "bg-gray-200"}`}>
                    {checkingIn ? <ActivityIndicator color="#fff" /> : (<Text className={`font-bold text-base ${checkCode.join("").length === 4 ? "text-white" : "text-gray-400"}`}><T>Verify & Check In</T></Text>)}
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}

            {/* In Progress */}
            {inProgress && (
              <Animated.View entering={FadeInUp.delay(300).duration(300)} className="mx-5 mt-4">
                <TouchableOpacity onPress={() => router.push("/(users)/active-ride" as any)} className="bg-blue-50 rounded-2xl p-4 flex-row items-center border border-blue-100" activeOpacity={0.7}>
                  <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3"><Ionicons name="navigate" size={20} color="#2563EB" /></View>
                  <View className="flex-1"><Text className="text-sm font-semibold text-blue-800"><T>Ride In Progress</T></Text><Text className="text-xs text-blue-500 mt-0.5"><T>Tap to view live tracking</T></Text></View>
                  <Ionicons name="chevron-forward" size={18} color="#2563EB" />
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Booking Info */}
            {booking && booking.status !== "cancelled" && booking.status !== "declined" && (
              <Animated.View entering={FadeInUp.delay(350).duration(300)} className="mx-5 mt-3 bg-gray-50 rounded-2xl p-4">
                <Text className="text-xs font-semibold text-gray-400 uppercase mb-3"><T>Your Booking</T></Text>
                <View className="flex-row justify-between mb-2"><Text className="text-xs text-gray-500"><T>Seats</T></Text><Text className="text-xs font-semibold text-gray-800">{booking.seats_requested}</Text></View>
                <View className="flex-row justify-between mb-2"><Text className="text-xs text-gray-500"><T>Payment</T></Text><Text className="text-xs font-semibold text-gray-800 capitalize">{booking.payment_method}</Text></View>
                <View className="flex-row justify-between mb-2"><Text className="text-xs text-gray-500"><T>Payment Status</T></Text>
                  <View className={`px-2 py-0.5 rounded-full ${booking.payment_status === "paid" ? "bg-green-50" : "bg-yellow-50"}`}><Text className={`text-[10px] font-semibold ${booking.payment_status === "paid" ? "text-green-600" : "text-yellow-600"}`}>{booking.payment_status}</Text></View>
                </View>
                <View className="flex-row justify-between"><Text className="text-xs text-gray-500"><T>Status</T></Text>
                  <View className={`px-2 py-0.5 rounded-full ${STATUS_BADGES[booking.status]?.bg || "bg-gray-100"}`}><Text className={`text-[10px] font-semibold ${STATUS_BADGES[booking.status]?.color || "text-gray-500"}`}>{booking.status}</Text></View>
                </View>
                {booking.check_in_code && (<View className="flex-row justify-between mt-2 pt-2 border-t border-gray-200"><Text className="text-xs text-gray-500"><T>Check-in Code</T></Text><Text className="text-sm font-bold text-accent tracking-widest">{booking.check_in_code}</Text></View>)}
              </Animated.View>
            )}

            {/* Cancelled / Declined */}
            {booking && (booking.status === "cancelled" || booking.status === "declined") && (
              <Animated.View entering={FadeInUp.delay(350).duration(300)} className="mx-5 mt-3">
                <View className="bg-red-50 rounded-2xl p-4 flex-row items-center border border-red-100">
                  <Ionicons name="close-circle" size={24} color="#EF4444" />
                  <View className="flex-1 ml-3"><Text className="text-sm font-semibold text-red-800"><T>{booking.status === "cancelled" ? "Booking Cancelled" : "Booking Declined"}</T></Text>
                    {booking.admin_note && <Text className="text-xs text-red-500 mt-0.5">{booking.admin_note}</Text>}
                  </View>
                </View>
              </Animated.View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Bottom Actions */}
        {(canBook || (booking && (booking.status === "pending" || booking.status === "accepted"))) && (
          <SafeAreaView edges={["bottom"]} className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 pt-3">
            {canBook ? (
              <Animated.View entering={FadeInDown.duration(300)}>
                {maxSeats > 1 && (<View className="flex-row items-center justify-between mb-3"><Text className="text-sm text-gray-600"><T>Seats</T></Text>
                  <View className="flex-row items-center gap-3">
                    <TouchableOpacity onPress={() => setSeats(Math.max(1, seats - 1))} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"><Ionicons name="remove" size={16} color="#042F40" /></TouchableOpacity>
                    <Text className="text-lg font-bold text-gray-800 w-6 text-center">{seats}</Text>
                    <TouchableOpacity onPress={() => setSeats(Math.min(maxSeats, seats + 1))} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"><Ionicons name="add" size={16} color="#042F40" /></TouchableOpacity>
                  </View>
                </View>)}
                <View className="flex-row gap-2 mb-3">
                  {(["cash", "transfer"] as const).map((m) => (
                    <TouchableOpacity key={m} onPress={() => setPayMethod(m)} className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center ${payMethod === m ? "bg-primary" : "bg-gray-100"}`}>
                      <Ionicons name={m === "cash" ? "cash-outline" : "card-outline"} size={16} color={payMethod === m ? "#fff" : "#6B7280"} />
                      <Text className={`ml-2 text-sm font-semibold ${payMethod === m ? "text-white" : "text-gray-600"}`}>{m === "cash" ? "Cash" : "Transfer"}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity onPress={handleBook} disabled={isBooking} className="bg-primary rounded-2xl py-4 items-center mb-2">
                  {isBooking ? <ActivityIndicator color="#fff" /> : (<Text className="text-white font-bold text-base"><T>Book Ride</T> · ₦{totalFare}</Text>)}
                </TouchableOpacity>
              </Animated.View>
            ) : booking && (booking.status === "pending" || booking.status === "accepted") ? (
              <TouchableOpacity onPress={handleCancel} disabled={cancelling} className="bg-red-50 rounded-2xl py-4 items-center mb-2 border border-red-100">
                {cancelling ? <ActivityIndicator color="#EF4444" /> : (<Text className="text-red-500 font-bold text-sm"><T>Cancel Booking</T></Text>)}
              </TouchableOpacity>
            ) : null}
          </SafeAreaView>
        )}
      </SafeAreaView>
    </View>
  );
}
