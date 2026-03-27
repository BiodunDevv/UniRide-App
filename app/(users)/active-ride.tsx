import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  BackHandler,
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  MapView,
  Camera,
  LocationPuck,
  Marker,
  Polyline,
} from "@/components/map/ExpoMap";
import Animated, { FadeInUp, FadeInDown } from "react-native-reanimated";

import { useRideStore, Booking, Ride } from "@/store/useRideStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useSocket } from "@/hooks/use-socket";
import { eventBus } from "@/lib/eventBus";
import { T } from "@/hooks/use-translation";
import { usePlatformSettingsStore } from "@/store/usePlatformSettingsStore";

export default function UserActiveRideScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    myBookings,
    fetchMyBookings,
    cancelBooking,
    fetchRideDetails,
    updatePaymentStatus,
  } = useRideStore();
  const { userLocation } = useLocationStore();
  const mapsEnabled = usePlatformSettingsStore(
    (state) => state.settings.expo_maps_enabled,
  );
  const { joinRide, leaveRide } = useSocket();
  const cameraRef = useRef<{ setCamera: (opts: any) => void }>(null);

  const [ride, setRide] = useState<Ride | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [driverCoords, setDriverCoords] = useState<[number, number] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState(false);
  const rideIdRef = useRef<string | null>(null);
  const [rideCompleted, setRideCompleted] = useState(false);
  const [mapType, setMapType] = useState<"hybrid" | "standard">("hybrid");

  // ── Find active booking & join ride room ──────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchMyBookings();
      const bks = useRideStore.getState().myBookings;
      const active = bks.find(
        (b) =>
          b.status === "in_progress" ||
          b.status === "accepted" ||
          b.status === "pending",
      );
      if (active) {
        setBooking(active);
        const rideId =
          typeof active.ride_id === "object"
            ? active.ride_id._id
            : active.ride_id;
        if (rideId) {
          rideIdRef.current = rideId;
          joinRide(rideId);
          try {
            const r = await fetchRideDetails(rideId);
            setRide(r);
            if (r.current_location?.coordinates)
              setDriverCoords(r.current_location.coordinates);
          } catch {}
        }
      }
      setLoading(false);
    })();
    return () => {
      if (rideIdRef.current) leaveRide(rideIdRef.current);
    };
  }, []);

  // ── Socket: driver location ───────────────────────────────────────
  useEffect(() => {
    const unsub = eventBus.on("driver-location-updated", (data: any) => {
      const latitude = data?.location?.latitude ?? data?.latitude;
      const longitude = data?.location?.longitude ?? data?.longitude;
      if (typeof latitude === "number" && typeof longitude === "number") {
        setDriverCoords([longitude, latitude]);
      }
    });
    return unsub;
  }, []);

  // ── Socket: booking / ride status changes ─────────────────────────
  useEffect(() => {
    const refresh = async () => {
      if (rideIdRef.current) {
        try {
          const r = await fetchRideDetails(rideIdRef.current);
          setRide(r);
        } catch {}
      }
      await fetchMyBookings();
      const bks = useRideStore.getState().myBookings;
      if (booking) {
        const updated = bks.find((b) => b._id === booking._id);
        if (updated) {
          setBooking(updated);
          if (updated.status === "completed") {
            setRideCompleted(true);
          } else if (updated.status === "cancelled") {
            router.back();
          }
        }
      }
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
  }, [booking]);

  useEffect(() => {
    const s = BackHandler.addEventListener("hardwareBackPress", () => {
      router.back();
      return true;
    });
    return () => s.remove();
  }, []);

  const handleCancel = () => {
    if (!booking) return;
    Alert.alert("Cancel Booking?", "This cannot be undone.", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          setCancelling(true);
          try {
            await cancelBooking(booking._id);
            router.back();
          } catch (e: any) {
            Alert.alert("Error", e?.message || "Failed");
          }
          setCancelling(false);
        },
      },
    ]);
  };

  const handleMarkPaid = async () => {
    if (!booking) return;
    try {
      await updatePaymentStatus(booking._id, "paid");
      setBooking({ ...booking, payment_status: "paid" });
      Alert.alert("Done", "Payment marked.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed");
    }
  };

  const copyAcct = async (text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInGoogleMaps = useCallback(async () => {
    const activeCoords =
      driverCoords ||
      ride?.current_location?.coordinates ||
      ride?.destination?.coordinates ||
      null;

    if (!activeCoords) {
      Alert.alert("Unavailable", "No ride location is available yet.");
      return;
    }

    const [longitude, latitude] = activeCoords;
    const pickupLabel =
      (ride &&
        typeof ride.pickup_location_id === "object" &&
        (ride.pickup_location_id.short_name || ride.pickup_location_id.name)) ||
      "Pickup";
    const destinationLabel =
      (ride &&
        typeof ride.destination_id === "object" &&
        (ride.destination_id.short_name || ride.destination_id.name)) ||
      "Destination";
    const label = encodeURIComponent(
      `${pickupLabel} to ${destinationLabel}`,
    );

    try {
      await Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}%20(${label})`,
      );
    } catch {
      Alert.alert("Error", "Unable to open Google Maps.");
    }
  }, [driverCoords, ride]);

  // ── Map data ──────────────────────────────────────────────────────
  const routeGeo = ride?.route_geometry || null;
  const routeCoordinates =
    routeGeo?.coordinates?.map?.((coordinate: [number, number]) => ({
      latitude: coordinate[1],
      longitude: coordinate[0],
    })) ||
    routeGeo?.geometry?.coordinates?.map?.((coordinate: [number, number]) => ({
      latitude: coordinate[1],
      longitude: coordinate[0],
    })) ||
    [];

  const pickup =
    ride && typeof ride.pickup_location_id === "object"
      ? ride.pickup_location_id
      : null;
  const dest =
    ride && typeof ride.destination_id === "object"
      ? ride.destination_id
      : null;
  const driverObj: any =
    ride?.driver_id && typeof ride.driver_id === "object"
      ? ride.driver_id
      : null;
  const driverUser: any =
    driverObj?.user_id && typeof driverObj.user_id === "object"
      ? driverObj.user_id
      : null;
  const needsCheckIn =
    booking?.status === "accepted" && booking?.check_in_status !== "checked_in";
  const driverName = driverUser?.name || driverObj?.name || "Driver";
  const driverPic = driverUser?.profile_picture || driverObj?.profile_picture;
  const driverInitials = driverName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const showBankDetails =
    booking &&
    booking.payment_method === "transfer" &&
    (booking.status === "accepted" || booking.status === "in_progress") &&
    driverObj?.bank_account_number;
  const totalFare = booking?.total_fare || ride?.fare || 0;

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#042F40" />
      </View>
    );
  if (!booking)
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
          <Ionicons name="car-outline" size={40} color="#D1D5DB" />
        </View>
        <Text className="text-lg font-bold text-gray-800 text-center mb-2">
          <T>No Active Ride</T>
        </Text>
        <Text className="text-sm text-gray-400 text-center mb-6">
          <T>You don't have an active ride right now</T>
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary rounded-2xl px-8 py-3"
        >
          <Text className="text-white font-bold">
            <T>Go Back</T>
          </Text>
        </TouchableOpacity>
      </View>
    );

  const center =
    driverCoords ||
    (userLocation
      ? ([userLocation.longitude, userLocation.latitude] as [number, number])
      : ([4.52, 7.52] as [number, number]));

  return (
    <View className="flex-1 bg-white">
      {/* ── Map ────────────────────────────────────────────────────── */}
      {mapsEnabled ? (
        <MapView
          style={{ flex: 1 }}
          mapType={mapType}
          showsCompass
          showsBuildings
        >
          <Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: center,
              zoomLevel: 14,
            }}
            animationDuration={1200}
          />
          <LocationPuck />
          {routeCoordinates.length > 1 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#042F40"
              strokeWidth={4}
            />
          )}
          {driverCoords && (
            <Marker
              coordinate={{
                latitude: driverCoords[1],
                longitude: driverCoords[0],
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <Image
                source={require("@/assets/images/car-marker.png")}
                style={{ width: 38, height: 38 }}
                resizeMode="contain"
              />
            </Marker>
          )}
        </MapView>
      ) : (
        <View className="flex-1 bg-slate-50 px-5 pt-28">
          <View className="rounded-[28px] border border-slate-200 bg-white px-5 py-5">
            <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Ride Tracking
            </Text>
            <Text className="mt-2 text-2xl font-bold text-slate-900">
              Live trip details are still available
            </Text>
            <Text className="mt-2 text-sm leading-6 text-slate-600">
              Your booking, driver updates, fare, and check-in flow are still
              active. The map view has been temporarily disabled by admin
              settings.
            </Text>
          </View>
        </View>
      )}

      {/* ── Header ─────────────────────────────────────────────────── */}
      <SafeAreaView
        edges={["top"]}
        className="absolute top-0 left-0 right-0 z-10"
        pointerEvents="box-none"
      >
        <View className="mx-5 mt-2 flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-white/95 w-10 h-10 rounded-full items-center justify-center"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
            }}
          >
            <Ionicons name="arrow-back" size={20} color="#042F40" />
          </TouchableOpacity>
          <View
            className="flex-1 mx-3 bg-white/95 rounded-2xl px-4 py-2.5"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
            }}
          >
            <Text className="text-sm font-bold text-gray-900">
              {booking.status === "in_progress" ? (
                <T>Ride In Progress</T>
              ) : booking.status === "accepted" ? (
                <T>Ready for Check-in</T>
              ) : (
                <T>Booking Pending</T>
              )}
            </Text>
          </View>
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
            onPress={() => {
              if (userLocation && cameraRef.current)
                cameraRef.current.setCamera({
                  centerCoordinate: [
                    userLocation.longitude,
                    userLocation.latitude,
                  ],
                  zoomLevel: 15,
                  animationDuration: 800,
                });
            }}
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
      </SafeAreaView>

      {/* ── Bottom Panel ───────────────────────────────────────────── */}
      <Animated.View
        entering={FadeInUp.delay(200).duration(400)}
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
        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          <SafeAreaView edges={["bottom"]} className="px-5 pb-2">
            {/* Route Summary */}
            <View className="flex-row items-center mb-3">
              <View className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2" />
              <Text className="text-xs text-gray-500 flex-1" numberOfLines={1}>
                {pickup?.short_name || pickup?.name || "Pickup"}
              </Text>
              <Ionicons name="arrow-forward" size={12} color="#D1D5DB" />
              <View className="w-2.5 h-2.5 rounded-full bg-red-500 mx-2" />
              <Text
                className="text-xs text-gray-500 flex-1 text-right"
                numberOfLines={1}
              >
                {dest?.short_name || dest?.name || "Destination"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleOpenInGoogleMaps}
              className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 flex-row items-center"
            >
              <Ionicons name="navigate-outline" size={18} color="#042F40" />
              <View className="ml-3 flex-1">
                <Text className="text-xs font-semibold text-slate-900">
                  <T>Open in Google Maps</T>
                </Text>
                <Text className="text-[10px] text-slate-500 mt-0.5">
                  <T>Open the latest saved ride location</T>
                </Text>
              </View>
              <Ionicons name="open-outline" size={16} color="#042F40" />
            </TouchableOpacity>

            {/* Driver Card with Profile Pic */}
            {driverObj && (
              <View className="bg-gray-50 rounded-xl p-3 mb-3">
                <View className="flex-row items-center">
                  {driverPic ? (
                    <Image
                      source={{ uri: driverPic }}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
                      <Text className="text-sm font-bold text-primary">
                        {driverInitials}
                      </Text>
                    </View>
                  )}
                  <View className="flex-1 ml-3">
                    <Text className="text-sm font-semibold text-gray-800">
                      {driverName}
                    </Text>
                    <View className="flex-row items-center mt-0.5">
                      <Ionicons name="star" size={11} color="#D4A017" />
                      <Text className="text-[10px] font-semibold text-accent ml-0.5">
                        {typeof driverObj.rating === "number"
                          ? driverObj.rating.toFixed(1)
                          : "5.0"}
                      </Text>
                      {driverObj.vehicle_model && (
                        <Text className="text-[10px] text-gray-400 ml-2">
                          {driverObj.vehicle_model}
                        </Text>
                      )}
                    </View>
                    {driverObj.plate_number && (
                      <Text className="text-[10px] font-bold text-primary tracking-wider mt-0.5">
                        {driverObj.plate_number}
                      </Text>
                    )}
                  </View>
                  <View className="flex-row gap-2">
                    {driverObj.phone && (
                      <TouchableOpacity
                        onPress={() =>
                          Linking.openURL(`tel:${driverObj.phone}`)
                        }
                        className="w-9 h-9 rounded-full bg-green-50 items-center justify-center"
                      >
                        <Ionicons name="call" size={16} color="#16A34A" />
                      </TouchableOpacity>
                    )}
                    {driverCoords && (
                      <View className="w-2.5 h-2.5 rounded-full bg-green-500 self-center" />
                    )}
                  </View>
                </View>
                {driverObj.vehicle_image && (
                  <Image
                    source={{ uri: driverObj.vehicle_image }}
                    className="w-full h-24 rounded-lg mt-2"
                    resizeMode="cover"
                  />
                )}
              </View>
            )}

            {/* Bank Details (Transfer Payment) */}
            {showBankDetails && (
              <View className="bg-blue-50 rounded-xl p-3 mb-3 border border-blue-100">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="card" size={16} color="#2563EB" />
                  <Text className="text-xs font-bold text-blue-900 ml-2">
                    <T>Transfer Payment</T>
                  </Text>
                  {booking.payment_status === "paid" && (
                    <View className="bg-green-100 rounded-full px-2 py-0.5 ml-auto">
                      <Text className="text-[10px] font-bold text-green-700">
                        <T>Paid</T>
                      </Text>
                    </View>
                  )}
                </View>
                <View className="bg-white rounded-lg p-2.5 border border-blue-50">
                  <View className="flex-row justify-between mb-1.5">
                    <Text className="text-[10px] text-gray-400">
                      <T>Bank</T>
                    </Text>
                    <Text className="text-xs font-semibold text-gray-800">
                      {driverObj?.bank_name || "—"}
                    </Text>
                  </View>
                  <View className="flex-row justify-between items-center mb-1.5">
                    <Text className="text-[10px] text-gray-400">
                      <T>Account No.</T>
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        copyAcct(driverObj?.bank_account_number || "")
                      }
                      className="flex-row items-center"
                    >
                      <Text className="text-sm font-bold text-primary tracking-wider mr-1.5">
                        {driverObj?.bank_account_number}
                      </Text>
                      <Ionicons
                        name={copied ? "checkmark-circle" : "copy-outline"}
                        size={13}
                        color={copied ? "#16A34A" : "#6B7280"}
                      />
                    </TouchableOpacity>
                  </View>
                  <View className="flex-row justify-between mb-1.5">
                    <Text className="text-[10px] text-gray-400">
                      <T>Name</T>
                    </Text>
                    <Text className="text-xs font-semibold text-gray-800">
                      {driverObj?.bank_account_name || "—"}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-[10px] text-gray-400">
                      <T>Amount</T>
                    </Text>
                    <Text className="text-base font-bold text-primary">
                      ₦{totalFare}
                    </Text>
                  </View>
                </View>
                {booking.payment_status !== "paid" && (
                  <TouchableOpacity
                    onPress={handleMarkPaid}
                    className="bg-blue-600 rounded-lg py-2.5 items-center mt-2"
                  >
                    <Text className="text-white font-bold text-xs">
                      <T>I've Sent the Money</T>
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Check-in Prompt */}
            {needsCheckIn && (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/(users)/ride-details" as any,
                    params: { bookingId: booking._id },
                  })
                }
                className="bg-accent/10 rounded-2xl p-4 mb-3 flex-row items-center border border-accent/20"
              >
                <View className="w-10 h-10 rounded-full bg-accent/20 items-center justify-center mr-3">
                  <Ionicons name="key" size={20} color="#D4A017" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900">
                    <T>Check In Required</T>
                  </Text>
                  <Text className="text-xs text-gray-500">
                    <T>Tap to enter your check-in code</T>
                  </Text>
                </View>
                {booking.check_in_code && (
                  <View className="bg-accent/20 rounded-xl px-3 py-1.5">
                    <Text className="text-xs font-bold text-accent tracking-widest">
                      {booking.check_in_code}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Cancel */}
            {(booking.status === "pending" ||
              booking.status === "accepted") && (
              <TouchableOpacity
                onPress={handleCancel}
                disabled={cancelling}
                className="bg-red-50 rounded-2xl py-3.5 items-center border border-red-100"
              >
                {cancelling ? (
                  <ActivityIndicator color="#EF4444" />
                ) : (
                  <Text className="text-red-500 font-semibold text-sm">
                    <T>Cancel Booking</T>
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </SafeAreaView>
        </ScrollView>
      </Animated.View>

      {/* ── Ride Completed Overlay ──────────────────────────────────── */}
      {rideCompleted && (
        <View className="absolute inset-0 z-50 bg-white">
          <SafeAreaView
            edges={["top", "bottom"]}
            className="flex-1 justify-center items-center px-8"
          >
            <Animated.View
              entering={FadeInUp.duration(500)}
              className="items-center"
            >
              <View className="w-20 h-20 rounded-full bg-green-100 items-center justify-center mb-4">
                <Ionicons name="checkmark-circle" size={48} color="#16A34A" />
              </View>
              <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
                <T>Ride Completed!</T>
              </Text>
              <Text className="text-sm text-gray-500 text-center mb-6">
                <T>
                  You've arrived at your destination. Thanks for riding with
                  UniRide!
                </T>
              </Text>

              {/* Summary */}
              <View className="bg-gray-50 rounded-2xl p-5 w-full mb-6">
                <View className="flex-row items-start mb-3">
                  <View className="items-center mr-3 mt-0.5">
                    <View className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <View className="w-0.5 h-6 bg-gray-200 my-0.5" />
                    <View className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-gray-800 mb-3">
                      {pickup?.short_name || pickup?.name || "Pickup"}
                    </Text>
                    <Text className="text-xs font-semibold text-gray-800">
                      {dest?.short_name || dest?.name || "Destination"}
                    </Text>
                  </View>
                </View>
                {driverObj && (
                  <View className="flex-row items-center pt-3 border-t border-gray-200">
                    {driverPic ? (
                      <Image
                        source={{ uri: driverPic }}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
                        <Ionicons name="person" size={14} color="#042F40" />
                      </View>
                    )}
                    <Text className="text-xs font-semibold text-gray-800 ml-2 flex-1">
                      {driverName}
                    </Text>
                    <View className="flex-row items-center">
                      <Ionicons name="star" size={11} color="#D4A017" />
                      <Text className="text-[10px] font-semibold text-accent ml-0.5">
                        {typeof driverObj?.rating === "number"
                          ? driverObj.rating.toFixed(1)
                          : "5.0"}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <TouchableOpacity
                onPress={() => router.back()}
                className="bg-primary rounded-2xl py-4 w-full items-center mb-3"
              >
                <Text className="text-white font-bold text-base">
                  <T>Back to Home</T>
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/(users)/activity" as any)}
                className="bg-gray-50 border border-gray-100 rounded-2xl py-3.5 w-full items-center flex-row justify-center"
              >
                <Ionicons name="receipt-outline" size={16} color="#042F40" />
                <Text className="text-gray-700 font-semibold text-sm ml-2">
                  <T>View Activity</T>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}
