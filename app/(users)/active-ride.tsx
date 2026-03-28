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
  InteractionManager,
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
import { useBootstrapStore } from "@/store/useBootstrapStore";
import { recordBootstrapTrace } from "@/lib/post-auth";
import { useLocation } from "@/hooks/use-location";
import { locationApi } from "@/lib/rideApi";

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
  const safeMode = useBootstrapStore((state) => state.safeMode);
  const { joinRide, leaveRide, streamPassengerLocation } = useSocket();
  const cameraRef = useRef<{ setCamera: (opts: any) => void }>(null);
  const { requestPermission, startWatching } = useLocation();

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
  const [allowMapCanvas, setAllowMapCanvas] = useState(false);
  const [driverLastUpdated, setDriverLastUpdated] = useState<string | null>(
    null,
  );

  const formatLiveStatus = useCallback((value?: string | null) => {
    if (!value) return "Waiting for live updates";
    const diffMs = Date.now() - new Date(value).getTime();
    const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
    if (diffMinutes < 1) return "Live now";
    if (diffMinutes === 1) return "Updated 1 min ago";
    if (diffMinutes < 60) return `Updated ${diffMinutes} mins ago`;
    const diffHours = Math.round(diffMinutes / 60);
    return `Updated ${diffHours}h ago`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const interactionHandle = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) {
        setAllowMapCanvas(Boolean(mapsEnabled) && !safeMode);
      }
    });

    recordBootstrapTrace(
      "user-active-ride:mount",
      safeMode ? "safe-mode" : "full-mode",
    ).catch(() => {});

    return () => {
      cancelled = true;
      interactionHandle.cancel();
    };
  }, [mapsEnabled, safeMode]);

  useEffect(() => {
    requestPermission()
      .then((granted) => {
        if (granted) {
          startWatching();
        }
      })
      .catch(() => {});
  }, [requestPermission, startWatching]);

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
      const completed =
        bks.find((b) => b.status === "completed") || null;
      const targetBooking = active || completed;

      if (targetBooking) {
        setBooking(targetBooking);
        if (targetBooking.status === "completed") {
          setRideCompleted(true);
        }
        const rideId =
          typeof targetBooking.ride_id === "object"
            ? targetBooking.ride_id._id
            : targetBooking.ride_id;
        if (rideId) {
          rideIdRef.current = rideId;
          joinRide(rideId);
          try {
            const r = await fetchRideDetails(rideId);
            setRide(r);
            if (r?.status === "completed") {
              setRideCompleted(true);
            }
            if (r.current_location?.coordinates) {
              setDriverCoords(r.current_location.coordinates);
              setDriverLastUpdated(new Date().toISOString());
            }
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
        setDriverLastUpdated(
          data?.timestamp
            ? new Date(data.timestamp).toISOString()
            : new Date().toISOString(),
        );
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!booking || !user || !userLocation) return;

    const rideId =
      typeof booking.ride_id === "object" ? booking.ride_id._id : booking.ride_id;
    if (!rideId) return;

    const emitLocation = () => {
      const liveLocation = useLocationStore.getState().userLocation;
      if (!liveLocation) return;
      streamPassengerLocation(
        user.id,
        String(rideId),
        liveLocation.latitude,
        liveLocation.longitude,
        user.name,
        user.profile_picture || null,
      );
      locationApi
        .updateUserLocation({
          latitude: liveLocation.latitude,
          longitude: liveLocation.longitude,
        })
        .catch(() => {});
    };

    emitLocation();
    const interval = setInterval(emitLocation, 5000);
    return () => clearInterval(interval);
  }, [booking, streamPassengerLocation, user, userLocation]);

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
  const driverId = driverObj?._id || null;
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

  const center =
    driverCoords ||
    (userLocation
      ? ([userLocation.longitude, userLocation.latitude] as [number, number])
      : ([4.52, 7.52] as [number, number]));
  const showMapCanvas = mapsEnabled && allowMapCanvas && !safeMode;

  const openDriverProfile = useCallback(() => {
    if (!driverId) return;
    router.push({
      pathname: "/(users)/driver-profile" as any,
      params: { driverId },
    });
  }, [driverId, router]);

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

  if (!ride)
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
          <Ionicons name="navigate-outline" size={40} color="#D1D5DB" />
        </View>
        <Text className="text-lg font-bold text-gray-800 text-center mb-2">
          <T>Ride details unavailable</T>
        </Text>
        <Text className="text-sm text-gray-400 text-center mb-6">
          <T>Your booking is active, but the live ride details could not load.</T>
        </Text>
        <TouchableOpacity
          onPress={() => fetchRideDetails(
            typeof booking.ride_id === "object" ? booking.ride_id._id : booking.ride_id,
          ).then(setRide).catch(() => router.back())}
          className="bg-primary rounded-2xl px-8 py-3"
        >
          <Text className="text-white font-bold">
            <T>Retry</T>
          </Text>
        </TouchableOpacity>
      </View>
    );

  return (
    <View className="flex-1 bg-slate-50">
      <SafeAreaView edges={["top", "bottom"]} className="flex-1">
        <View className="mx-5 mt-2 flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-white w-10 h-10 rounded-full items-center justify-center"
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
            className="flex-1 mx-3 bg-white rounded-2xl px-4 py-2.5"
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
        </View>

        {showMapCanvas ? (
          <View className="mx-5 mt-3 h-[280px] overflow-hidden rounded-[28px] bg-white">
            <MapView style={{ flex: 1 }} mapType={mapType} showsCompass showsBuildings>
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
            <View className="absolute right-3 top-3 gap-2">
              <TouchableOpacity
                onPress={() =>
                  setMapType((current) =>
                    current === "hybrid" ? "standard" : "hybrid",
                  )
                }
                className="bg-white/95 w-10 h-10 rounded-full items-center justify-center"
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
              >
                <Ionicons name="locate" size={20} color="#042F40" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View className="mx-5 mt-3 rounded-[28px] border border-slate-200 bg-white px-5 py-5">
            <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Ride Tracking
            </Text>
            <Text className="mt-2 text-2xl font-bold text-slate-900">
              Live trip details are still available
            </Text>
            <Text className="mt-2 text-sm leading-6 text-slate-600">
              Your booking, driver updates, fare, and check-in flow are still active. The map view has been temporarily disabled by admin settings.
            </Text>
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
        )}

        <ScrollView
          className="flex-1 mt-3"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 28 }}
        >
          <View className="px-5 pb-2">
            <View className="mb-4 rounded-[24px] bg-[#042F40] px-4 py-4">
              <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D4A017]">
                Live Trip
              </Text>
              <Text className="mt-1 text-lg font-bold text-white">
                {booking.status === "in_progress" ? (
                  <T>Ride In Progress</T>
                ) : booking.status === "accepted" ? (
                  <T>Ready for Check-in</T>
                ) : (
                  <T>Booking Pending</T>
                )}
              </Text>
              <Text className="mt-1 text-xs leading-5 text-slate-300">
                <T>Follow the latest ride status, driver details, and payment steps from one place.</T>
              </Text>
            </View>

            <View className="mb-3 flex-row gap-3">
              <View className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <Text className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Driver live
                </Text>
                <Text className="mt-1 text-sm font-bold text-slate-900">
                  {driverCoords ? "Tracking your driver" : "Waiting for driver"}
                </Text>
                <Text className="mt-1 text-xs text-slate-500">
                  {formatLiveStatus(driverLastUpdated)}
                </Text>
                {driverCoords ? (
                  <Text className="mt-1 text-[11px] text-slate-400">
                    {driverCoords[1].toFixed(5)}, {driverCoords[0].toFixed(5)}
                  </Text>
                ) : null}
              </View>
              <View className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <Text className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Your location
                </Text>
                <Text className="mt-1 text-sm font-bold text-slate-900">
                  {userLocation ? "Sharing current position" : "Location pending"}
                </Text>
                <Text className="mt-1 text-xs text-slate-500">
                  {userLocation ? "Visible for ride coordination" : "Waiting for GPS access"}
                </Text>
                {userLocation ? (
                  <Text className="mt-1 text-[11px] text-slate-400">
                    {userLocation.latitude.toFixed(5)},{" "}
                    {userLocation.longitude.toFixed(5)}
                  </Text>
                ) : null}
              </View>
            </View>
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
                    <TouchableOpacity
                      onPress={openDriverProfile}
                      className="w-9 h-9 rounded-full bg-slate-900 items-center justify-center"
                    >
                      <Ionicons name="person-outline" size={16} color="#fff" />
                    </TouchableOpacity>
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
                <TouchableOpacity
                  onPress={openDriverProfile}
                  activeOpacity={0.85}
                  className="mt-3 flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      Driver Profile
                    </Text>
                    <Text className="mt-1 text-sm font-semibold text-slate-900">
                      View driver info, ratings, and ride identity
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#042F40" />
                </TouchableOpacity>
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
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* ── Ride Completed Overlay ──────────────────────────────────── */}
      {rideCompleted && (
        <View className="absolute inset-0 z-50 bg-white">
          <SafeAreaView
            edges={["top", "bottom"]}
            className="flex-1 justify-center px-6"
          >
            <Animated.View
              entering={FadeInUp.duration(500)}
              className="rounded-[32px] border border-slate-200 bg-white px-6 py-7"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.08,
                shadowRadius: 20,
              }}
            >
              <View className="items-center">
                <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                  <Ionicons name="checkmark-circle" size={48} color="#16A34A" />
                </View>
                <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  <T>Trip Complete</T>
                </Text>
                <Text className="mt-2 text-center text-2xl font-bold text-slate-900">
                  <T>Ride Completed!</T>
                </Text>
                <Text className="mt-2 text-center text-sm leading-6 text-slate-500">
                  <T>
                    You've arrived at your destination. Thanks for riding with
                    UniRide.
                  </T>
                </Text>
              </View>

              <View className="mt-6 rounded-[28px] bg-slate-50 p-5">
                <View className="mb-4 flex-row items-center justify-between">
                  <Text className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <T>Journey Summary</T>
                  </Text>
                  <View className="rounded-full bg-emerald-50 px-3 py-1.5">
                    <Text className="text-[11px] font-semibold text-emerald-700">
                      <T>Completed</T>
                    </Text>
                  </View>
                </View>
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
                  <View className="flex-row items-center border-t border-slate-200 pt-4">
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
                className="mt-6 w-full items-center rounded-2xl bg-primary py-4"
              >
                <Text className="text-white font-bold text-base">
                  <T>Back to Home</T>
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/(users)/activity" as any)}
                className="mt-3 w-full flex-row items-center justify-center rounded-2xl border border-slate-200 bg-white py-3.5"
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
